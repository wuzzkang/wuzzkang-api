import { jest } from '@jest/globals';

// Mock supabase-js
const mockSupabase = {
    rpc: jest.fn(),
    from: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    insert: jest.fn(),
};

// Helper to setup a chain
const setupChain = () => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
}));

// Dynamically import walletService after mocking
const { walletService } = await import('../../src/services/wallet.service.js');

describe('WalletService', () => {
    const userId = '00000000-0000-0000-0000-000000000000';

    beforeEach(() => {
        jest.clearAllMocks();
        setupChain();
    });

    describe('getBalance', () => {
        it('should return the balance from the profile', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: { balance: 50000 }, error: null });

            const balance = await walletService.getBalance(userId);

            expect(balance).toBe(50000);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('get_or_create_profile', { p_user_id: userId });
        });

        it('should throw an error if the RPC fails', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

            await expect(walletService.getBalance(userId)).rejects.toThrow('Database error');
        });
    });

    describe('deductBalance', () => {
        it('should deduct balance successfully (Happy Path)', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: { new_balance: 40000, transaction_id: 'tx-123' }, error: null });

            const result = await walletService.deductBalance(userId, 10000, 'generation', '00000000-0000-0000-0000-000000000001', 'Test deduction');

            expect(result.newBalance).toBe(40000);
            expect(result.transactionId).toBe('tx-123');
            expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_user_balance', {
                p_user_id: userId,
                p_amount: 10000,
                p_type: 'generation',
                p_project_id: '00000000-0000-0000-0000-000000000001',
                p_description: 'Test deduction',
            });
        });

        it('should throw INSUFFICIENT_FUNDS if the RPC returns that error', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'INSUFFICIENT_FUNDS' } });

            await expect(walletService.deductBalance(userId, 100000, 'generation')).rejects.toThrow('INSUFFICIENT_FUNDS');
        });
    });

    describe('addTransaction', () => {
        it('should add transaction and update balance successfully', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: { balance: 50000 }, error: null });
            mockSupabase.eq.mockResolvedValueOnce({ error: null }); // Final call in update chain
            mockSupabase.insert.mockResolvedValueOnce({ error: null }); // Final call in insert chain

            const newBalance = await walletService.addTransaction(userId, 20000, 'topup', 'Test topup');

            expect(newBalance).toBe(70000);
            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ balance: 70000 }));
            expect(mockSupabase.insert).toHaveBeenCalledWith([expect.objectContaining({ amount: 20000, type: 'topup' })]);
        });

        it('should throw an error if update fails', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: { balance: 50000 }, error: null });
            mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'Update failed' } });

            await expect(walletService.addTransaction(userId, 20000, 'topup')).rejects.toThrow('Update failed');
        });
    });
});
