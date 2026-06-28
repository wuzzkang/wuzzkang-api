import { Router } from 'express';
import { supabaseService } from '../services/supabase.service.js';
import { projectService } from '../services/project.service.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for deploying a draft project.
 */
const DeployProjectSchema = z.object({
    slug: z
        .string()
        .min(3)
        .max(50)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Slug hanya boleh mengandung huruf, angka, strip (-), atau underscore (_)'),
    couponCode: z.string().optional().nullable(),
});

/**
 * POST /api/projects/:id/deploy
 * Deploys a draft project (Deducts balance, Marks as Deployed).
 */
router.post('/projects/:id/deploy', async (req, res, next) => {
    const { id } = req.params;
    const validation = DeployProjectSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const { slug, couponCode } = validation.data;
        const userId = req.user.id;
        const result = await projectService.deployDraftProject(userId, id, slug, couponCode);

        return res.status(200).json(result);
    } catch (err) {
        if (err.message.includes('Saldo tidak cukup')) {
            return res.status(402).json({ success: false, error: err.message });
        }
        return res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * Request body schema for retrying GitHub Pages.
 */
const RetryPagesSchema = z.object({});

/**
 * POST /api/projects/:id/retry-pages
 * Retries enabling GitHub Pages for an already deployed project.
 */
router.post('/projects/:id/retry-pages', async (req, res, next) => {
    const { id } = req.params;
    const validation = RetryPagesSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const userId = req.user.id;
        const result = await projectService.retryGitHubPages(userId, id);
        return res.status(200).json(result);
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /api/projects
 * Lists projects for a user (userId passed as query param for now).
 */
router.get('/projects', async (req, res, next) => {
    const userId = req.user.id;

    try {
        const projects = await supabaseService.listProjects(userId);
        return res.json({ success: true, data: projects });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /api/projects/:id
 * Gets details for a specific project.
 */
router.get('/projects/:id', async (req, res, next) => {
    const { id } = req.params;

    try {
        const project = await supabaseService.getProject(id);
        return res.json({ success: true, data: project });
    } catch (err) {
        return next(err);
    }
});

export default router;
