import { Router } from 'express';
import { supabaseService } from '../services/supabase.service.js';

const router = Router();

/**
 * GET /api/profile
 * Gets user profile (including balance).
 */
router.get('/profile', async (req, res, next) => {
    const userId = req.user.id;

    try {
        const profile = await supabaseService.getProfile(userId);
        return res.status(200).json({
            success: true,
            data: profile
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
