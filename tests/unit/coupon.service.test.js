import { jest } from '@jest/globals';

// Mock supabase-js
const mockSupabase = {
    from: jest.fn(),
    select: jest.fn(),
    ilike: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
};

// Chain setup
const setupChain = () => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.ilike.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.single.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
}));

// Import couponService dynamically
const { couponService } = await import('../../src/services/coupon.service.js');

describe('CouponService', () => {
    const userId = 'user-uuid-123';
    const mockCoupon = {
        id: 'coupon-uuid-999',
        code: 'PROMO100',
        discount_type: 'percentage',
        discount_value: 100,
        max_uses: 10,
        uses_count: 0,
        max_uses_per_user: 1,
        expires_at: null,
        is_active: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        setupChain();
    });

    describe('validateCoupon', () => {
        it('should validate a valid coupon successfully', async () => {
            // Mock coupon fetch
            mockSupabase.single.mockResolvedValueOnce({ data: mockCoupon, error: null });
            // Mock usages count check (0 uses so far)
            mockSupabase.eq
                .mockReturnValueOnce(mockSupabase)
                .mockResolvedValueOnce({ count: 0, error: null });

            const result = await couponService.validateCoupon('PROMO100', userId);

            expect(result).toEqual({
                id: 'coupon-uuid-999',
                code: 'PROMO100',
                discount_type: 'percentage',
                discount_value: 100,
                max_uses_per_user: 1
            });
            expect(mockSupabase.ilike).toHaveBeenCalledWith('code', 'PROMO100');
        });

        it('should throw an error if coupon not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

            await expect(couponService.validateCoupon('INVALID_CODE', userId))
                .rejects.toThrow('Kupon tidak valid atau tidak ditemukan.');
        });

        it('should throw an error if coupon is inactive', async () => {
            const inactiveCoupon = { ...mockCoupon, is_active: false };
            mockSupabase.single.mockResolvedValueOnce({ data: inactiveCoupon, error: null });

            await expect(couponService.validateCoupon('PROMO100', userId))
                .rejects.toThrow('Kupon ini sudah tidak aktif.');
        });

        it('should throw an error if coupon is expired', async () => {
            const expiredCoupon = { ...mockCoupon, expires_at: new Date(Date.now() - 3600000).toISOString() };
            mockSupabase.single.mockResolvedValueOnce({ data: expiredCoupon, error: null });

            await expect(couponService.validateCoupon('PROMO100', userId))
                .rejects.toThrow('Kupon ini telah kedaluwarsa.');
        });

        it('should throw an error if global usage limit is reached', async () => {
            const limitCoupon = { ...mockCoupon, max_uses: 5, uses_count: 5 };
            mockSupabase.single.mockResolvedValueOnce({ data: limitCoupon, error: null });

            await expect(couponService.validateCoupon('PROMO100', userId))
                .rejects.toThrow('Kuota pemakaian kupon ini telah habis.');
        });

        it('should throw an error if user usage limit is reached', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: mockCoupon, error: null });
            mockSupabase.eq
                .mockReturnValueOnce(mockSupabase)
                .mockResolvedValueOnce({ count: 1, error: null });

            await expect(couponService.validateCoupon('PROMO100', userId))
                .rejects.toThrow('Batas pemakaian kupon ini untuk akun Anda telah tercapai (1x).');
        });
    });

    describe('recordUsage', () => {
        it('should insert usage and increment uses count successfully', async () => {
            // Mock insert call (resolves on insert)
            mockSupabase.insert.mockResolvedValueOnce({ error: null });
            
            // Mock get uses_count call
            // first eq call in recordUsage returns builder
            mockSupabase.eq.mockReturnValueOnce(mockSupabase);
            // single call resolves
            mockSupabase.single.mockResolvedValueOnce({ data: { uses_count: 2 }, error: null });
            
            // second eq call in recordUsage resolves update
            mockSupabase.eq.mockResolvedValueOnce({ error: null });

            await couponService.recordUsage('coupon-uuid-999', userId);

            expect(mockSupabase.insert).toHaveBeenCalledWith([{ coupon_id: 'coupon-uuid-999', user_id: userId }]);
            expect(mockSupabase.update).toHaveBeenCalledWith({ uses_count: 3 });
            expect(mockSupabase.eq).toHaveBeenLastCalledWith('id', 'coupon-uuid-999');
        });
    });
});
