import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
import { walletService } from './wallet.service.js';
import { getDeploymentQueue } from '../queues/queue.js';
import { githubService } from './github.service.js';
import { config } from '../config/index.js';

const GENERATION_COST = 10000; // 10,000 credits/balance

/**
 * Orchestrator service for project-related operations.
 */
export const projectService = {
    /**
     * Deploys a draft project: deducts balance, verifies draft, and queues deployment.
     * 
     * @param {string} userId - The ID of the user.
     * @param {string} projectId - The ID of the draft project.
     * @param {string} repoName - The target GitHub repo name.
     */
    async deployDraftProject(userId, projectId, repoName) {
        console.log(`[ProjectService] Starting deployment for draft project ${projectId} by user ${userId}...`);

        // 1. Verify project
        const project = await supabaseService.getProject(projectId);
        if (!project) throw new Error('Proyek tidak ditemukan.');
        if (project.user_id !== userId) throw new Error('Anda tidak memiliki akses ke proyek ini.');
        if (project.status !== 'draft') throw new Error('Proyek sudah dideploy atau sedang dalam proses.');

        // 2. Deduct balance first (Fail fast if insufficient funds)
        let transactionId;
        try {
            const deduction = await walletService.deductBalance(
                userId,
                GENERATION_COST,
                'deployment',
                projectId,
                `Deployment cost for project: ${project.name}`
            );
            transactionId = deduction.transactionId;
            console.log(`[ProjectService] Balance deducted: ${GENERATION_COST}, Transaction ID: ${transactionId}`);
        } catch (error) {
            if (error.message === 'INSUFFICIENT_FUNDS') {
                throw new Error('Saldo tidak cukup untuk mendeploy proyek. Biaya: 10.000');
            }
            throw error;
        }

        try {
            // 3. Update status to deploying
            await supabaseService.updateProjectStatus(projectId, 'deploying');

            // 4. Queue Deployment
            console.log(`[ProjectService] Queuing deployment for ${repoName}...`);
            const queue = getDeploymentQueue();
            await queue.add('deploy-job', {
                projectId,
                pageData: project.page_data,
                repoName,
            });

            return {
                success: true,
                projectId,
                message: 'Proyek sedang dideploy.',
            };
        } catch (error) {
            console.error(`[ProjectService] Error during deployment queuing: ${error.message}`);

            // Rollback: Refund balance if execution fails
            try {
                console.log(`[ProjectService] Attempting to refund ${GENERATION_COST} credits to user ${userId}...`);
                await walletService.addTransaction(
                    userId,
                    GENERATION_COST,
                    'refund',
                    `Refund for failed deployment queuing: ${project.name}`
                );
                console.log(`[ProjectService] Refund successful.`);
            } catch (refundError) {
                console.error(`[ProjectService] CRITICAL: Refund failed for user ${userId}: ${refundError.message}`);
                // We don't throw refundError here to ensure the original error is re-thrown
            }

            // Re-throw original error
            throw error;
        }
    },

    /**
     * Retries enabling GitHub Pages for an existing project.
     * 
     * @param {string} userId - The ID of the user.
     * @param {string} projectId - The ID of the project.
     */
    async retryGitHubPages(userId, projectId) {
        console.log(`[ProjectService] Retrying GitHub Pages for project ${projectId}...`);

        const project = await supabaseService.getProject(projectId);
        if (!project) throw new Error('Proyek tidak ditemukan.');
        if (project.user_id !== userId) throw new Error('Anda tidak memiliki akses ke proyek ini.');
        
        if (!project.repo_url) {
            throw new Error('Repository belum dibuat. Tidak bisa mengaktifkan Pages.');
        }

        const parts = project.repo_url.split('/');
        const repoName = parts[parts.length - 1];

        await githubService.enablePages(config.GITHUB_ORG_NAME, repoName);

        return {
            success: true,
            message: 'Aktivasi GitHub Pages sedang diulang.',
        };
    },
};
