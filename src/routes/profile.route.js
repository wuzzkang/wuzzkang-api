import { Router } from 'express';
import { walletService } from '../services/wallet.service.js';

const router = Router();

/**
 * GET /api/profile
 * Gets user profile (including balance).
 */
router.get('/profile', async (req, res, next) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }

    try {
        const balance = await walletService.getBalance(userId);
        return res.status(200).json({
            success: true,
            data: {
                id: userId,
                balance: balance
            }
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
