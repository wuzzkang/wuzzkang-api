import { Router } from 'express';
import { couponService } from '../services/coupon.service.js';
import { z } from 'zod';

const router = Router();

const ValidateCouponSchema = z.object({
    code: z.string().min(1, 'Kode kupon harus diisi'),
});

/**
 * POST /api/coupons/validate
 * Validates a coupon code and returns discount calculation.
 */
router.post('/coupons/validate', async (req, res, next) => {
    const validation = ValidateCouponSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error.flatten().fieldErrors,
        });
    }

    try {
        const { code } = validation.data;
        const userId = req.user.id;
        const couponInfo = await couponService.validateCoupon(code, userId);

        return res.status(200).json({
            success: true,
            data: couponInfo,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            error: err.message,
        });
    }
});

export default router;
