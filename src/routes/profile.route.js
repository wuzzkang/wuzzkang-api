import { Router } from 'express';
import { supabaseService } from '../services/supabase.service.js';
import { getRedisClient } from '../utils/redis.js';

const router = Router();

/**
 * GET /api/profile
 * Gets user profile (including balance, daily AI limits and remaining free runs).
 */
router.get('/profile', async (req, res, next) => {
    const userId = req.user.id;

    try {
        const [profile, settings] = await Promise.all([
            supabaseService.getProfile(userId),
            supabaseService.getSystemSettings()
        ]);

        // Fetch daily usage from Redis to compute remainingFree AI generates
        const redis = getRedisClient();
        const today = new Date().toISOString().split('T')[0];
        const redisKey = `wuzzkang:user:${userId}:ai_field_limit:${today}`;
        let count = await redis.get(redisKey);
        count = count ? parseInt(count, 10) : 0;

        // Fallback profile configurations to global system settings
        const dailyLimit = profile.daily_ai_limit ?? settings.daily_ai_limit ?? 15;
        const cost = profile.ai_generate_cost ?? settings.ai_generate_cost ?? 100;

        profile.daily_ai_limit = dailyLimit;
        profile.ai_generate_cost = cost;
        profile.remainingFree = Math.max(0, dailyLimit - count);

        return res.status(200).json({
            success: true,
            data: profile
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
