import { Router } from 'express';
import { generateLandingPage, generateFieldContent } from '../services/ai.service.js';
import { supabaseService } from '../services/supabase.service.js';
import { walletService } from '../services/wallet.service.js';
import { getRedisClient } from '../utils/redis.js';
import { z } from 'zod';

const router = Router();

/**
 * Request body schema for the /generate endpoint.
 */
const GenerateRequestSchema = z.object({
    projectId: z.string().uuid().optional().nullable(),
    name: z.string().min(3, 'name must be at least 3 characters').max(100, 'name must not exceed 100 characters'),
    template_type: z.string().default('store'),
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
    birthday_details: z.object({
        design_key: z.enum(['cute-balloon', 'elegant-gold']).default('cute-balloon'),
        celebrant: z.object({
            name: z.string().min(2),
            nickname: z.string().min(1),
            age: z.string().min(1),
            parent_name: z.string().optional().nullable(),
            image_url: z.string().optional().nullable(),
            gender: z.enum(['male', 'female']).optional().nullable(),
        }),
        event: z.object({
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
    toko_online_details: z.object({
        design_key: z.enum(['modern-clean', 'midnight-dark']).default('modern-clean'),
        store: z.object({
            name: z.string().min(2),
            tagline: z.string().min(2),
            description: z.string().optional().nullable(),
            logo_url: z.string().optional().nullable(),
            banner_url: z.string().optional().nullable(),
        }),
        products: z.array(z.object({
            name: z.string().min(2),
            price: z.string().min(1),
            description: z.string().optional().nullable(),
            image_url: z.string().optional().nullable(),
        })).min(1).max(6),
        contact: z.object({
            whatsapp: z.string().min(5),
            instagram: z.string().optional().nullable(),
            shopee_url: z.string().optional().nullable(),
            tokopedia_url: z.string().optional().nullable(),
            address: z.string().optional().nullable(),
        }),
        quote: z.string().optional().nullable(),
    }).optional(),
    campaign_details: z.object({
        design_key: z.enum(['neon-conversion', 'clean-trust']).default('neon-conversion'),
        brief: z.string().optional().nullable(),
        hero: z.object({
            headline: z.string().min(5),
            subheadline: z.string().min(10),
            cta_text: z.string().min(2),
        }),
        problems: z.object({
            title: z.string().min(3),
            list: z.array(z.string().min(5)).min(1).max(8),
        }),
        solutions: z.object({
            title: z.string().min(3),
            intro: z.string().min(5),
            benefits: z.array(z.object({
                title: z.string().min(3),
                desc: z.string().min(5),
            })).min(1).max(6),
        }),
        social_proof: z.object({
            testimonials: z.array(z.object({
                name: z.string().min(2),
                role: z.string().optional().nullable(),
                content: z.string().min(5),
            })).min(1).max(4),
            guarantee: z.string().optional().nullable(),
        }),
        closing: z.object({
            urgency: z.string().min(5),
            cta_text: z.string().min(2),
        }),
        contact: z.object({
            whatsapp: z.string().min(5),
        }),
    }).optional(),
});

/**
 * POST /api/generate
 * Generates a complete landing page JSON from a user-provided prompt.
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
        const { projectId, name, prompt, template_type, wedding_details, birthday_details, toko_online_details, campaign_details } = validation.data;
        const userId = req.user.id;

        // Check if template_type is active and registered in the database products table
        const product = await supabaseService.getProduct(template_type);
        if (!product) {
            return res.status(400).json({
                success: false,
                error: { template_type: [`Tipe template '${template_type}' tidak terdaftar.`] },
            });
        }
        if (!product.is_active) {
            return res.status(400).json({
                success: false,
                error: { template_type: [`Layanan pembuatan '${product.name}' saat ini dinonaktifkan sementara.`] },
            });
        }

        // Custom validation checks
        if (template_type === 'wedding' && !wedding_details) {
            return res.status(400).json({
                success: false,
                error: { wedding_details: ['wedding_details is required when template_type is wedding'] },
            });
        }

        if (template_type === 'birthday' && !birthday_details) {
            return res.status(400).json({
                success: false,
                error: { birthday_details: ['birthday_details is required when template_type is birthday'] },
            });
        }

        if (template_type === 'toko-online' && !toko_online_details) {
            return res.status(400).json({
                success: false,
                error: { toko_online_details: ['toko_online_details is required when template_type is toko-online'] },
            });
        }

        if (template_type === 'campaign' && !campaign_details) {
            return res.status(400).json({
                success: false,
                error: { campaign_details: ['campaign_details is required when template_type is campaign'] },
            });
        }

        const pageData = await generateLandingPage(prompt, template_type, wedding_details, birthday_details, toko_online_details, campaign_details);

        let project;
        if (projectId) {
            console.log(`[GeneratorRoute] Updating existing project draft ${projectId} for user ${userId}...`);
            project = await supabaseService.updateProject(projectId, userId, {
                name: name,
                pageData: pageData,
            });
        } else {
            console.log(`[GeneratorRoute] Creating a new project draft for user ${userId}...`);
            project = await supabaseService.saveProject(userId, {
                name: name,
                pageData: pageData,
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                projectId: project.id,
                pageData: pageData,
            }
        });
    } catch (err) {
        return next(err);
    }
});

const GenerateFieldRequestSchema = z.object({
    fieldType: z.enum([
        'store_description',
        'product_description',
        'store_quote',
        'campaign_hero',
        'campaign_problems',
        'campaign_benefits',
        'campaign_testimonials',
        'campaign_urgency'
    ]),
    context: z.object({
        storeName: z.string().optional(),
        storeTagline: z.string().optional(),
        productName: z.string().optional(),
        productPrice: z.string().optional(),
        campaignName: z.string().optional(),
        campaignBrief: z.string().optional(),
    }),
});

/**
 * POST /api/generate/field
 * Generates copy content for a specific input field in a structured form.
 */
router.post('/generate/field', async (req, res, next) => {
    const validation = GenerateFieldRequestSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const { fieldType, context } = validation.data;
        const userId = req.user.id;

        // Fetch user profile and system settings
        const [profile, settings] = await Promise.all([
            supabaseService.getProfile(userId),
            supabaseService.getSystemSettings()
        ]);
        const dailyLimit = profile.daily_ai_limit ?? settings.daily_ai_limit ?? 15;
        const cost = profile.ai_generate_cost ?? settings.ai_generate_cost ?? 100;
        const balance = profile.balance ?? 0;

        // Check Redis daily count
        const redis = getRedisClient();
        const today = new Date().toISOString().split('T')[0];
        const redisKey = `wuzzkang:user:${userId}:ai_field_limit:${today}`;

        let count = await redis.get(redisKey);
        count = count ? parseInt(count, 10) : 0;

        let chargedAmount = 0;

        if (count < dailyLimit) {
            // Under free quota limits: execute for free
            const content = await generateFieldContent(fieldType, context);
            
            // Increment Redis counter
            const newCount = await redis.incr(redisKey);
            if (count === 0) {
                // Set key expiry to 48 hours to clean up old keys
                await redis.expire(redisKey, 86400 * 2);
            }

            return res.status(200).json({
                success: true,
                data: {
                    content,
                    remainingFree: Math.max(0, dailyLimit - newCount),
                    charged: 0
                },
            });
        } else {
            // Quota exhausted: check if balance is sufficient
            if (balance < cost) {
                return res.status(402).json({
                    success: false,
                    error: `Jatah generate gratis harian Anda (${dailyLimit} kali) telah habis, dan saldo dompet Anda (Rp ${balance.toLocaleString('id-ID')}) tidak mencukupi untuk tarif berbayar (Rp ${cost.toLocaleString('id-ID')} per generate). Harap isi ulang saldo terlebih dahulu.`
                });
            }

            // Deduct balance
            await walletService.deductBalance(
                userId,
                cost,
                'ai_generation',
                null,
                `AI Generate Field (${fieldType})`
            );

            const content = await generateFieldContent(fieldType, context);
            chargedAmount = cost;

            return res.status(200).json({
                success: true,
                data: {
                    content,
                    remainingFree: 0,
                    charged: chargedAmount
                },
            });
        }
    } catch (err) {
        return next(err);
    }
});

export default router;
