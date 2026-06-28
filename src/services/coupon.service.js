import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const supabase = createClient(
    config.SUPABASE_URL || '',
    config.SUPABASE_SERVICE_KEY || ''
);

export const couponService = {
    /**
     * Validates a coupon code for a specific user and returns discount info.
     * 
     * @param {string} code - The coupon code to validate.
     * @param {string} userId - The ID of the user applying the coupon.
     * @returns {Promise<Object>} Object containing discount info.
     */
    async validateCoupon(code, userId) {
        if (!code || typeof code !== 'string') {
            throw new Error('Kode kupon harus diisi.');
        }

        // 1. Fetch coupon by code (case-insensitive)
        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', code.trim())
            .single();

        if (error || !coupon) {
            throw new Error('Kupon tidak valid atau tidak ditemukan.');
        }

        // 2. Check if active
        if (!coupon.is_active) {
            throw new Error('Kupon ini sudah tidak aktif.');
        }

        // 3. Check if expired
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            throw new Error('Kupon ini telah kedaluwarsa.');
        }

        // 4. Check global usage limit
        if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
            throw new Error('Kuota pemakaian kupon ini telah habis.');
        }

        // 5. Check user usage limit
        if (coupon.max_uses_per_user !== null) {
            const { count, error: countError } = await supabase
                .from('coupon_usages')
                .select('id', { count: 'exact', head: true })
                .eq('coupon_id', coupon.id)
                .eq('user_id', userId);

            if (countError) {
                console.error('[CouponService] Error checking user usage count:', countError);
                throw new Error('Gagal memverifikasi pemakaian kupon.');
            }

            if (count !== null && count >= coupon.max_uses_per_user) {
                throw new Error(`Batas pemakaian kupon ini untuk akun Anda telah tercapai (${coupon.max_uses_per_user}x).`);
            }
        }

        return {
            id: coupon.id,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: Number(coupon.discount_value),
            max_uses_per_user: coupon.max_uses_per_user
        };
    },

    /**
     * Records coupon usage for a user and increments global use count.
     * 
     * @param {string} couponId - The ID of the coupon.
     * @param {string} userId - The ID of the user.
     */
    async recordUsage(couponId, userId) {
        // 1. Record the user usage in coupon_usages
        const { error: usageError } = await supabase
            .from('coupon_usages')
            .insert([
                {
                    coupon_id: couponId,
                    user_id: userId,
                }
            ]);

        if (usageError) {
            console.error('[CouponService] Failed to insert coupon usage record:', usageError);
            throw new Error('Gagal mencatat pemakaian kupon.');
        }

        // 2. Increment global uses_count in coupons table
        const { data: coupon, error: fetchErr } = await supabase
            .from('coupons')
            .select('uses_count')
            .eq('id', couponId)
            .single();

        if (fetchErr || !coupon) {
            console.error('[CouponService] Failed to fetch coupon for incrementing uses:', fetchErr);
            return;
        }

        const newUsesCount = (coupon.uses_count || 0) + 1;

        const { error: updateErr } = await supabase
            .from('coupons')
            .update({ uses_count: newUsesCount })
            .eq('id', couponId);

        if (updateErr) {
            console.error('[CouponService] Failed to increment global coupons count:', updateErr);
        }
    }
};
