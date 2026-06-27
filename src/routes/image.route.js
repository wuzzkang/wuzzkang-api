import { Router } from 'express';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { supabaseService } from '../services/supabase.service.js';
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

        return res.status(200).json({
            success: true,
            url: uploadResult.publicUrl,
        });
    } catch (err) {
        console.error('[ImageRoute] Error generating/uploading image:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Gagal men-generate gambar menggunakan AI.',
        });
    }
});

export default router;
