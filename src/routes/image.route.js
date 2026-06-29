import { Router } from 'express';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { supabaseService } from '../services/supabase.service.js';
import { walletService } from '../services/wallet.service.js';
import { getRedisClient } from '../utils/redis.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * POST /api/generate-image
 * Generates an image using OpenAI DALL-E based on prompt, downloads it,
 * and uploads it to Supabase Storage.
 */
router.post('/generate-image', async (req, res, next) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    try {
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

        let isPaid = count >= dailyLimit;

        // Verify balance if paid
        if (isPaid && balance < cost) {
            return res.status(402).json({
                success: false,
                error: `Jatah generate gratis harian Anda (${dailyLimit} kali) telah habis, dan saldo dompet Anda (Rp ${balance.toLocaleString('id-ID')}) tidak mencukupi untuk tarif berbayar (Rp ${cost.toLocaleString('id-ID')} per generate). Harap isi ulang saldo terlebih dahulu.`
            });
        }

        // Generate image or fallback to mock avatar
        let imageUrl = '';
        try {
            const apiKey = config.OPENAI_API_KEY || process.env.OPENAPI_API_KEY;
            if (!apiKey) {
                throw new Error('OpenAI API key (OPENAI_API_KEY) is not configured in backend.');
            }

            const openai = new OpenAI({ apiKey });

            console.log(`[ImageRoute] Generating AI avatar with prompt: "${prompt}" using gpt-image-1...`);
            const response = await openai.images.generate({
                model: "gpt-image-1",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
            });

            const tempUrl = response.data[0]?.url;
            if (!tempUrl) {
                throw new Error('No image URL returned from OpenAI.');
            }

            // Download the generated image
            const imageRes = await fetch(tempUrl);
            if (!imageRes.ok) {
                throw new Error(`Failed to download image from OpenAI CDN: ${imageRes.statusText}`);
            }
            const buffer = Buffer.from(await imageRes.arrayBuffer());

            // Upload to Supabase Storage in bucket 'wuzzkang-bucket'
            const ext = 'png';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            console.log(`[ImageRoute] Uploading image buffer to Supabase wuzzkang-bucket storage as ${fileName}...`);
            
            const uploadResult = await supabaseService.uploadWeddingAsset(fileName, buffer, 'image/png');
            imageUrl = uploadResult.publicUrl;
        } catch (openaiErr) {
            // Re-throw so the outer handler returns an error response.
            // The dashboard already has correct gendered default avatars (DEFAULT_GROOM_AVATAR /
            // DEFAULT_BRIDE_AVATAR) in its own catch block, so returning success:false here
            // is the correct approach — it lets the client pick the right default per target.
            console.warn('[ImageRoute] OpenAI DALL-E execution failed:', openaiErr.message);
            throw new Error(openaiErr.message || 'Gagal men-generate gambar via AI.');
        }

        // Deduct balance or increment Redis counter AFTER successful execution (or mock)
        if (isPaid) {
            await walletService.deductBalance(
                userId,
                cost,
                'ai_generation',
                null,
                `AI Image Generate (${prompt.substring(0, 30)}...)`
            );
        } else {
            await redis.incr(redisKey);
            if (count === 0) {
                await redis.expire(redisKey, 86400 * 2);
            }
        }

        const newCount = isPaid ? count : count + 1;

        return res.status(200).json({
            success: true,
            url: imageUrl,
            remainingFree: Math.max(0, dailyLimit - newCount),
            charged: isPaid ? cost : 0
        });

    } catch (err) {
        console.error('[ImageRoute] Error in generate-image handler:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Gagal memproses pembuatan gambar AI.',
        });
    }
});

export default router;
