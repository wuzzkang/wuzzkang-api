import { Router } from 'express';
import { generateLandingPage } from '../services/ai.service.js';
import { supabaseService } from '../services/supabase.service.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for the /generate endpoint.
 */
const GenerateRequestSchema = z.object({
    userId: z.string().uuid({ message: 'userId must be a valid UUID' }),
    name: z.string().min(3, 'name must be at least 3 characters').max(100, 'name must not exceed 100 characters'),
    prompt: z
        .string({ required_error: 'prompt is required' })
        .min(10, 'prompt must be at least 10 characters')
        .max(500, 'prompt must not exceed 500 characters'),
});

/**
 * POST /api/generate
 * Generates a complete landing page JSON from a user-provided prompt.
 *
 * @body {{ prompt: string }} - The niche or description for the landing page.
 * @returns {{ success: true, data: PageSchema }} The validated landing page data.
 */
router.post('/generate', async (req, res, next) => {
    const validation = GenerateRequestSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const { userId, name, prompt } = validation.data;
        const pageData = await generateLandingPage(prompt);

        // Save as draft in database
        const project = await supabaseService.saveProject(userId, {
            name: name,
            pageData: pageData,
        });

        return res.status(200).json({
            success: true,
            data: {
                projectId: project.id,
                pageData: pageData,
            }
        });
    } catch (err) {
        // Forward to centralized error middleware
        return next(err);
    }
});

export default router;
