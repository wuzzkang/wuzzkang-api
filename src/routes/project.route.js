import { Router } from 'express';
import { supabaseService } from '../services/supabase.service.js';
import { projectService } from '../services/project.service.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for creating a project.
 */
const CreateProjectSchema = z.object({
    userId: z.string().uuid(),
    name: z.string().min(3).max(100),
    prompt: z.string().min(10).max(500),
    repoName: z.string().min(3).max(100),
});

/**
 * POST /api/projects
 * Creates a new project (Deducts balance, Generates AI, Saves, Queues Deployment).
 */
router.post('/projects', async (req, res, next) => {
    const validation = CreateProjectSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const { userId, name, prompt, repoName } = validation.data;
        const result = await projectService.createProject(userId, name, prompt, repoName);

        return res.status(201).json(result);
    } catch (err) {
        if (err.message.includes('Saldo tidak cukup')) {
            return res.status(402).json({ success: false, error: err.message });
        }
        return next(err);
    }
});

/**
 * GET /api/projects
 * Lists projects for a user (userId passed as query param for now).
 */
router.get('/projects', async (req, res, next) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }

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
