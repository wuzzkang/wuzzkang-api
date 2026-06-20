import { Router } from 'express';
import { getDeploymentQueue } from '../queues/queue.js';
import { PageSchema } from '../utils/schema.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for the /deploy endpoint.
 */
const DeployRequestSchema = z.object({
    projectId: z.string().uuid(),
    pageData: PageSchema,
    repoName: z.string().min(3).max(100),
    templateOwner: z.string().default('wuzzkang'), // Default template owner
    templateRepo: z.string().default('landing-page-template'), // Default template repo
});

/**
 * POST /api/deploy
 * Adds a deployment job to the queue.
 *
 * @body {{ pageData: PageSchema, repoName: string, templateOwner?: string, templateRepo?: string }}
 * @returns {{ success: true, jobId: string }}
 */
router.post('/deploy', async (req, res, next) => {
    const validation = DeployRequestSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const queue = getDeploymentQueue();
        const job = await queue.add('deploy-job', validation.data);

        return res.status(202).json({
            success: true,
            message: 'Deployment job added to queue',
            jobId: job.id,
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
