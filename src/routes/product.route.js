import { Router } from 'express';
import { supabaseService } from '../services/supabase.service.js';

const router = Router();

/**
 * GET /api/products
 * Retrieves list of all products/template types.
 */
router.get('/products', async (req, res, next) => {
    try {
        const products = await supabaseService.getProducts();
        return res.status(200).json({
            success: true,
            data: products
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
