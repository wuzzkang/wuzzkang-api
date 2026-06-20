import { Worker } from 'bullmq';
import { redisConnection } from './queue.js';
import { githubService } from '../services/github.service.js';
import { supabaseService } from '../services/supabase.service.js';
import { config } from '../config/index.js';

let workerInstance = null;

/**
 * Starts the deployment worker (Lazy Initialization).
 * 
 * @returns {Worker}
 */
export function startDeployWorker() {
    if (workerInstance) return workerInstance;

    workerInstance = new Worker(
        'deployment-queue',
        async (job) => {
            const { projectId, pageData, repoName } = job.data;
            const templateRepo = config.GITHUB_TEMPLATE_REPO;

            console.log(`[Worker] Starting deployment for Project ID: ${projectId}...`);

            try {
                // 1. Create repo from template in 'wuzzkang' org
                console.log(`[Worker] Creating repo ${repoName} from template ${templateRepo}...`);
                await githubService.createRepoFromTemplate(templateRepo, repoName);

                // 2. Update content.json with AI data
                console.log(`[Worker] Updating content.json in ${repoName}...`);
                await githubService.updateFileInRepo(repoName, pageData);

                // 3. Update status in Supabase
                console.log(`[Worker] Updating status to 'deployed' for Project ID: ${projectId}...`);
                await supabaseService.updateProjectStatus(projectId, 'deployed');

                console.log(`[Worker] Deployment for ${repoName} successful!`);
                return { success: true, repoUrl: `https://wuzzkang.github.io/${repoName}` };
            } catch (error) {
                console.error(`[Worker] Deployment failed for ${repoName}: ${error.message}`);
                // Update status to 'failed' in Supabase if it's the last attempt
                if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
                    await supabaseService.updateProjectStatus(projectId, 'failed');
                }
                throw error;
            }
        },
        {
            connection: redisConnection,
        }
    );

    workerInstance.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed.`);
    });

    workerInstance.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
    });

    return workerInstance;
}
