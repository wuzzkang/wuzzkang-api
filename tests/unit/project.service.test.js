import { jest } from '@jest/globals';

// 1. Define Mocks
const mockWalletService = {
    deductBalance: jest.fn(),
    addTransaction: jest.fn(),
    updateTransactionStatus: jest.fn(),
};

const mockSupabaseService = {
    getProject: jest.fn(),
    getProjectBySlug: jest.fn(),
    getProduct: jest.fn(),
    deployProject: jest.fn(),
    updateDeployedProject: jest.fn(),
};

const mockCouponService = {
    validateCoupon: jest.fn(),
    recordUsage: jest.fn(),
};

// 2. Setup ESM Mocking
jest.unstable_mockModule('../../src/services/wallet.service.js', () => ({
    walletService: mockWalletService,
}));

jest.unstable_mockModule('../../src/services/supabase.service.js', () => ({
    supabaseService: mockSupabaseService,
}));

jest.unstable_mockModule('../../src/services/coupon.service.js', () => ({
    couponService: mockCouponService,
}));

// 3. Import ProjectService after mocking
const { projectService } = await import('../../src/services/project.service.js');

describe('ProjectService deployDraftProject Test Suite', () => {
    const userId = 'user-123';
    const projectId = 'project-123';
    const slug = 'pernikahan-zubair';
    const dynamicCost = 10000;

    const mockProjectData = {
        id: projectId,
        user_id: userId,
        name: 'Zubair & Nadin',
        status: 'draft',
        page_data: {
            meta: {
                template_type: 'wedding'
            }
        }
    };

    const mockProductData = {
        id: 'wedding',
        name: 'Undangan Pernikahan',
        is_active: true,
        cost: dynamicCost
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default path mocks
        mockSupabaseService.getProject.mockResolvedValue(mockProjectData);
        mockSupabaseService.getProjectBySlug.mockResolvedValue(null);
        mockSupabaseService.getProduct.mockResolvedValue(mockProductData);
        mockSupabaseService.deployProject.mockResolvedValue({ success: true });
        mockWalletService.deductBalance.mockResolvedValue({ newBalance: 40000, transactionId: 'tx-123' });
        mockWalletService.updateTransactionStatus.mockResolvedValue(true);
    });

    it('should successfully deploy project with full price when no coupon is applied', async () => {
        const result = await projectService.deployDraftProject(userId, projectId, slug, null);

        expect(result.success).toBe(true);
        expect(result.liveUrl).toContain(slug);

        // Deducts full cost
        expect(mockWalletService.deductBalance).toHaveBeenCalledWith(
            userId,
            dynamicCost,
            'deployment',
            projectId,
            expect.stringContaining('Zubair & Nadin')
        );
        expect(mockWalletService.updateTransactionStatus).toHaveBeenCalledWith('tx-123', 'PAID');
        expect(mockCouponService.validateCoupon).not.toHaveBeenCalled();
    });

    it('should successfully apply coupon with 50% discount and deduct remaining balance', async () => {
        const mockCoupon = {
            id: 'coupon-abc',
            code: 'DISKON50',
            discount_type: 'percentage',
            discount_value: 50
        };
        mockCouponService.validateCoupon.mockResolvedValue(mockCoupon);

        const result = await projectService.deployDraftProject(userId, projectId, slug, 'DISKON50');

        expect(result.success).toBe(true);

        // Deducts 50% of the cost (5000)
        expect(mockWalletService.deductBalance).toHaveBeenCalledWith(
            userId,
            5000,
            'deployment',
            projectId,
            expect.stringContaining('DISKON50')
        );
        expect(mockCouponService.recordUsage).toHaveBeenCalledWith('coupon-abc', userId);
    });

    it('should bypass balance deduction when 100% discount coupon is applied', async () => {
        const mockCoupon = {
            id: 'coupon-free',
            code: 'DISKON100',
            discount_type: 'percentage',
            discount_value: 100
        };
        mockCouponService.validateCoupon.mockResolvedValue(mockCoupon);
        mockWalletService.addTransaction.mockResolvedValue(50000); // For free tx log

        const result = await projectService.deployDraftProject(userId, projectId, slug, 'DISKON100');

        expect(result.success).toBe(true);

        // Balance deduction is bypassed (deductBalance is not called)
        expect(mockWalletService.deductBalance).not.toHaveBeenCalled();
        // A Rp 0 transaction log is recorded instead
        expect(mockWalletService.addTransaction).toHaveBeenCalledWith(
            userId,
            0,
            'deployment',
            expect.stringContaining('DISKON100'),
            projectId
        );
        expect(mockCouponService.recordUsage).toHaveBeenCalledWith('coupon-free', userId);
    });

    it('should refund deducted balance if direct deployment fails', async () => {
        // Mock deploy function to throw an error
        mockSupabaseService.deployProject.mockRejectedValue(new Error('DEPLOY_ERROR'));
        mockWalletService.addTransaction.mockResolvedValue(50000); // For refund

        await expect(
            projectService.deployDraftProject(userId, projectId, slug, null)
        ).rejects.toThrow('DEPLOY_ERROR');

        // Deduct was called
        expect(mockWalletService.deductBalance).toHaveBeenCalled();
        // Refund was issued for full amount
        expect(mockWalletService.addTransaction).toHaveBeenCalledWith(
            userId,
            dynamicCost,
            'refund',
            expect.stringContaining('Refund')
        );
    });

    describe('editDeployedProject', () => {
        const mockDeployedProject = {
            ...mockProjectData,
            status: 'deployed',
            edit_count: 0
        };

        beforeEach(() => {
            mockSupabaseService.getProject.mockResolvedValue(mockDeployedProject);
            mockSupabaseService.updateDeployedProject.mockResolvedValue({ success: true });
        });

        it('should successfully update a deployed project and increment edit count', async () => {
            const updatedPageData = {
                content: {
                    groom: { nickname: 'Zubair' },
                    bride: { nickname: 'Nadin' }
                }
            };
            const result = await projectService.editDeployedProject(userId, projectId, updatedPageData);

            expect(result.success).toBe(true);
            expect(result.editCount).toBe(1);
            expect(mockSupabaseService.updateDeployedProject).toHaveBeenCalledWith(
                projectId,
                userId,
                expect.objectContaining({
                    name: 'Undangan Zubair & Nadin',
                    editCount: 1
                })
            );
        });

        it('should throw error if edit count limit (3) is exceeded', async () => {
            const limitedProject = { ...mockDeployedProject, edit_count: 3 };
            mockSupabaseService.getProject.mockResolvedValue(limitedProject);

            await expect(
                projectService.editDeployedProject(userId, projectId, {})
            ).rejects.toThrow('Batas maksimal edit (3x) telah tercapai');
        });

        it('should throw error if template type is not wedding', async () => {
            const storeProject = {
                ...mockDeployedProject,
                page_data: { meta: { template_type: 'store' } }
            };
            mockSupabaseService.getProject.mockResolvedValue(storeProject);

            await expect(
                projectService.editDeployedProject(userId, projectId, {})
            ).rejects.toThrow('Hanya tipe undangan pernikahan yang diizinkan');
        });

        it('should throw error if status is not deployed', async () => {
            const draftProject = { ...mockDeployedProject, status: 'draft' };
            mockSupabaseService.getProject.mockResolvedValue(draftProject);

            await expect(
                projectService.editDeployedProject(userId, projectId, {})
            ).rejects.toThrow('Hanya proyek yang sudah dipublikasikan');
        });
    });
});
