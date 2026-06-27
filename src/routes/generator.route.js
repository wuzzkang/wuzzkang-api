import { Router } from 'express';
import { generateLandingPage } from '../services/ai.service.js';
import { supabaseService } from '../services/supabase.service.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for the /generate endpoint.
 */
const GenerateRequestSchema = z.object({
    name: z.string().min(3, 'name must be at least 3 characters').max(100, 'name must not exceed 100 characters'),
    template_type: z.enum(['store', 'wedding']).default('store'),
    prompt: z
        .string()
        .max(500, 'prompt must not exceed 500 characters')
        .optional()
        .nullable(),
    wedding_details: z.object({
        design_key: z.enum(['sage-green', 'floral-pink']).default('sage-green'),
        groom: z.object({
            name: z.string().min(2),
            nickname: z.string().min(1),
            father: z.string().min(2),
            mother: z.string().min(2),
            image_url: z.string().optional().nullable(),
        }),
        bride: z.object({
            name: z.string().min(2),
            nickname: z.string().min(1),
            father: z.string().min(2),
            mother: z.string().min(2),
            image_url: z.string().optional().nullable(),
        }),
        story: z.array(z.object({
            title: z.string().min(1),
            date: z.string().min(1),
            desc: z.string().min(1),
            image_url: z.string().optional().nullable(),
        })).optional().nullable(),
        akad: z.object({
            date: z.string(),
            time: z.string(),
            location: z.string().min(3),
            maps_url: z.string().optional().nullable(),
        }),
        resepsi: z.object({
            date: z.string(),
            time: z.string(),
            location: z.string().min(3),
            maps_url: z.string().optional().nullable(),
        }),
        gift: z.object({
            bank_name: z.string().optional().nullable(),
            account_number: z.string().optional().nullable(),
            account_holder: z.string().optional().nullable(),
        }).optional().nullable(),
    }).optional(),
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
        const { name, prompt, template_type, wedding_details } = validation.data;
        const userId = req.user.id;

        // Custom validation check: if template_type is wedding, wedding_details is required
        if (template_type === 'wedding' && !wedding_details) {
            return res.status(400).json({
                success: false,
                error: { wedding_details: ['wedding_details is required when template_type is wedding'] },
            });
        }

        const pageData = await generateLandingPage(prompt, template_type, wedding_details);

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
