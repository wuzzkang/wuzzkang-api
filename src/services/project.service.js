import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
import { walletService } from './wallet.service.js';
import { getDeploymentQueue } from '../queues/queue.js';

const GENERATION_COST = 10000; // 10,000 credits/balance

/**
 * Orchestrator service for project-related operations.
 */
export const projectService = {
    /**
     * Creates a new project: deducts balance, generates AI content, saves to DB, and queues deployment.
     * 
     * @param {string} userId - The ID of the user.
     * @param {string} projectName - The name of the project.
     * @param {string} prompt - The AI prompt.
     * @param {string} repoName - The target GitHub repo name.
     */
    async createProject(userId, projectName, prompt, repoName) {
        console.log(`[ProjectService] Starting project creation for user ${userId}...`);

        // 1. Deduct balance first (Fail fast if insufficient funds)
        try {
            await walletService.deductBalance(
                userId,
                GENERATION_COST,
                'generation',
                null,
                `Generation cost for project: ${projectName}`
            );
            console.log(`[ProjectService] Balance deducted: ${GENERATION_COST}`);
        } catch (error) {
            if (error.message === 'INSUFFICIENT_FUNDS') {
                throw new Error('Saldo tidak cukup untuk membuat proyek. Biaya: 10.000');
            }
            throw error;
        }

        let projectId;
        try {
            // 2. Generate AI Content
            console.log(`[ProjectService] Generating AI content for prompt: "${prompt}"...`);
            const pageData = await aiService.generateLandingPage(prompt);

            // 3. Save to Supabase
            console.log(`[ProjectService] Saving project to database...`);
            const project = await supabaseService.saveProject(userId, {
                name: projectName,
                pageData: pageData,
            });
            projectId = project.id;

            // 4. Queue Deployment
            console.log(`[ProjectService] Queuing deployment for ${repoName}...`);
            const queue = getDeploymentQueue();
            await queue.add('deploy-job', {
                projectId,
                pageData,
                repoName,
            });

            return {
                success: true,
                projectId,
                message: 'Proyek sedang diproses dan dideploy.',
            };
        } catch (error) {
            console.error(`[ProjectService] Error during project creation: ${error.message}`);

            // Step 3 (Safety Net/Rollback): Refund balance if execution fails
            try {
                console.log(`[ProjectService] Attempting to refund ${GENERATION_COST} credits to user ${userId}...`);
                await walletService.addTransaction(
                    userId,
                    GENERATION_COST,
                    'refund',
                    `Refund for failed project creation: ${projectName}`
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
};
