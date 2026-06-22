import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

/**
 * Service for managing user wallet and transactions.
 */
export const walletService = {
    /**
     * Gets user balance. Creates profile if it doesn't exist.
     * 
     * @param {string} userId - The ID of the user.
     * @returns {Promise<number>} The user's balance.
     */
    async getBalance(userId) {
        const { data, error } = await supabase.rpc('get_or_create_profile', {
            p_user_id: userId,
        });

        if (error) throw new Error(error.message);
        return data.balance;
    },

    /**
     * Deducts balance from user wallet atomically.
     * 
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount to deduct.
     * @param {string} type - The transaction type.
     * @param {string} projectId - The associated project ID (optional).
     * @param {string} description - Transaction description.
     * @returns {Promise<{ newBalance: number, transactionId: string }>}
     */
    async deductBalance(userId, amount, type, projectId = null, description = '') {
        const { data, error } = await supabase.rpc('deduct_user_balance', {
            p_user_id: userId,
            p_amount: amount,
            p_type: type,
            p_project_id: projectId,
            p_description: description,
        });

        if (error) {
            if (error.message.includes('INSUFFICIENT_FUNDS')) {
                throw new Error('INSUFFICIENT_FUNDS');
            }
            throw new Error(error.message);
        }

        return {
            newBalance: data.new_balance,
            transactionId: data.transaction_id,
        };
    },

    /**
     * Adds a transaction (e.g., for top-up).
     * 
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount to add.
     * @param {string} type - The transaction type.
     * @param {string} description - Transaction description.
     * @param {string} orderId - Unique order identifier for idempotency.
     */
    async addTransaction(userId, amount, type, description = '', orderId = null) {
        // For top-ups, we can just update the balance and insert a transaction.
        // In a real SaaS, this would be triggered by a payment gateway webhook.
        const { data: profile, error: profileError } = await supabase.rpc('get_or_create_profile', {
            p_user_id: userId,
        });
        if (profileError) throw new Error(profileError.message);

        const newBalance = profile.balance + amount;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (updateError) throw new Error(updateError.message);

        const { error: transError } = await supabase.from('transactions').insert([
            {
                user_id: userId,
                amount: amount,
                type: type,
                description: description,
                order_id: orderId,
            },
        ]);

        if (transError) throw new Error(transError.message);

        return newBalance;
    },

    /**
     * Completes a pending transaction and updates user balance.
     * 
     * @param {string} transactionId - The ID of the transaction.
     * @returns {Promise<number>} The new balance.
     */
    async completeTransaction(transactionId) {
        // 1. Get transaction details
        const { data: transaction, error: transError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (transError || !transaction) throw new Error('Transaction not found');
        if (transaction.status === 'PAID') return; // Already processed

        // 2. Update balance and transaction status
        const { data: profile, error: profileError } = await supabase.rpc('get_or_create_profile', {
            p_user_id: transaction.user_id,
        });
        if (profileError) throw new Error(profileError.message);

        const newBalance = Number(profile.balance) + Number(transaction.amount);

        // Use a transaction or RPC for atomicity if possible, 
        // but for now we'll do it sequentially as per existing pattern.
        const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', transaction.user_id);

        if (updateProfileError) throw new Error(updateProfileError.message);

        const { error: updateTransError } = await supabase
            .from('transactions')
            .update({ status: 'PAID' })
            .eq('id', transactionId);

        if (updateTransError) throw new Error(updateTransError.message);

        return newBalance;
    },

    /**
     * Updates the project_id of a transaction.
     * 
     * @param {string} transactionId - The ID of the transaction.
     * @param {string} projectId - The ID of the project to link.
     */
    async updateTransactionProject(transactionId, projectId) {
        const { error } = await supabase
            .from('transactions')
            .update({ project_id: projectId })
            .eq('id', transactionId);

        if (error) throw new Error(error.message);
    },
};
