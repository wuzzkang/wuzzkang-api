import { jest } from '@jest/globals';

// 1. Define Mocks
const mockWalletService = {
    deductBalance: jest.fn(),
    addTransaction: jest.fn(),
};

const mockAiService = {
    generateLandingPage: jest.fn(),
};

const mockSupabaseService = {
    saveProject: jest.fn(),
};

const mockQueue = {
    add: jest.fn(),
};

// 2. Setup ESM Mocking
jest.unstable_mockModule('../../src/services/wallet.service.js', () => ({
    walletService: mockWalletService,
}));

jest.unstable_mockModule('../../src/services/ai.service.js', () => ({
    aiService: mockAiService,
}));

jest.unstable_mockModule('../../src/services/supabase.service.js', () => ({
    supabaseService: mockSupabaseService,
}));

jest.unstable_mockModule('../../src/queues/queue.js', () => ({
    getDeploymentQueue: jest.fn(() => mockQueue),
}));

// 3. Import ProjectService after mocking
const { projectService } = await import('../../src/services/project.service.js');

describe('ProjectService Orchestration Integration Test', () => {
    const userId = 'user-123';
    const projectName = 'Test Project';
    const prompt = 'A cool landing page';
    const repoName = 'test-repo';
    const GENERATION_COST = 10000;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createProject', () => {
        it('should successfully create a project and deduct balance without refund', async () => {
            // Setup Success Mocks
            mockWalletService.deductBalance.mockResolvedValue(40000);
            mockAiService.generateLandingPage.mockResolvedValue({ title: 'Success' });
            mockSupabaseService.saveProject.mockResolvedValue({ id: 'project-123' });
            mockQueue.add.mockResolvedValue({ id: 'job-123' });

            const result = await projectService.createProject(userId, projectName, prompt, repoName);

            // Assertions
            expect(result.success).toBe(true);
            expect(result.projectId).toBe('project-123');

            // Verify balance deduction
            expect(mockWalletService.deductBalance).toHaveBeenCalledWith(
                userId,
                GENERATION_COST,
                'generation',
                null,
                expect.stringContaining(projectName)
            );

            // Verify execution steps
            expect(mockAiService.generateLandingPage).toHaveBeenCalledWith(prompt);
            expect(mockSupabaseService.saveProject).toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalled();

            // Verify NO refund was issued
            expect(mockWalletService.addTransaction).not.toHaveBeenCalled();
        });

        it('should refund balance if AI generation fails', async () => {
            // Setup Failure Mocks
            mockWalletService.deductBalance.mockResolvedValue(40000);
            mockAiService.generateLandingPage.mockRejectedValue(new Error('AI_FAILURE'));
            mockWalletService.addTransaction.mockResolvedValue(50000);

            // Execute and expect error
            await expect(
                projectService.createProject(userId, projectName, prompt, repoName)
            ).rejects.toThrow('AI_FAILURE');

            // Assertions
            expect(mockWalletService.deductBalance).toHaveBeenCalled();

            // Verify refund was issued
            expect(mockWalletService.addTransaction).toHaveBeenCalledWith(
                userId,
                GENERATION_COST,
                'refund',
                expect.stringContaining(projectName)
            );
        });

        it('should refund balance if saving to database fails', async () => {
            // Setup Failure Mocks
            mockWalletService.deductBalance.mockResolvedValue(40000);
            mockAiService.generateLandingPage.mockResolvedValue({ title: 'Success' });
            mockSupabaseService.saveProject.mockRejectedValue(new Error('DB_FAILURE'));
            mockWalletService.addTransaction.mockResolvedValue(50000);

            // Execute and expect error
            await expect(
                projectService.createProject(userId, projectName, prompt, repoName)
            ).rejects.toThrow('DB_FAILURE');

            // Verify refund was issued
            expect(mockWalletService.addTransaction).toHaveBeenCalledWith(
                userId,
                GENERATION_COST,
                'refund',
                expect.stringContaining(projectName)
            );
        });

        it('should still re-throw original error even if refund fails', async () => {
            // Setup Failure Mocks
            mockWalletService.deductBalance.mockResolvedValue(40000);
            mockAiService.generateLandingPage.mockRejectedValue(new Error('ORIGINAL_ERROR'));
            mockWalletService.addTransaction.mockRejectedValue(new Error('REFUND_ERROR'));

            // Execute and expect ORIGINAL error
            await expect(
                projectService.createProject(userId, projectName, prompt, repoName)
            ).rejects.toThrow('ORIGINAL_ERROR');

            // Verify refund was attempted
            expect(mockWalletService.addTransaction).toHaveBeenCalled();
        });
    });
});
