import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { PaymentFactory } from './payments/factory.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

/**
 * Service for orchestrating payment transactions.
 */
export const transactionService = {
    /**
     * Creates a new payment transaction with "Pending-then-Update" flow.
     * 
     * @param {number} amount - Transaction amount.
     * @param {string} userId - User ID.
     * @param {string} channel - Payment channel (e.g., 'CIMB').
     * @returns {Promise<Object>} The transaction result.
     */
    async createTransaction(amount, userId, channel) {
        const orderId = `INV-${Date.now()}`;

        // Winpay requires customerNo to be a numeric string.
        // Since userId is a UUID, we'll use a default numeric string for now,
        // or you can fetch the user's phone number if available.
        const customerNo = '081234567890';

        console.log(`[TransactionService] Creating pending transaction for user ${userId}, amount ${amount}`);

        // 1. Insert PENDING transaction
        const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert([
                {
                    user_id: userId,
                    amount: amount,
                    type: 'topup',
                    status: 'PENDING',
                    order_id: orderId,
                    description: `Top-up via ${channel}`,
                    metadata: { channel, customerNo }
                }
            ])
            .select()
            .single();

        if (insertError) {
            console.error(`[TransactionService] Failed to create pending transaction: ${insertError.message}`);
            throw new Error(`Failed to create pending transaction: ${insertError.message}`);
        }

        try {
            // 2. Call WinpayProvider
            const provider = await PaymentFactory.getProvider();
            // Pass the numeric customerNo instead of the UUID userId
            const winpayResult = await provider.createTransaction(amount, customerNo, orderId);

            // 3. Update with VA number
            const { error: updateError } = await supabase
                .from('transactions')
                .update({
                    va_number: winpayResult.vaNumber,
                    metadata: { ...transaction.metadata, winpay: winpayResult }
                })
                .eq('id', transaction.id);

            if (updateError) {
                console.error(`[TransactionService] Failed to update VA number: ${updateError.message}`);
            }

            return {
                ...transaction,
                va_number: winpayResult.vaNumber,
                winpay: winpayResult
            };
        } catch (error) {
            console.error(`[TransactionService] Winpay creation failed: ${error.message}`);

            // 4. Update status to FAILED
            await supabase
                .from('transactions')
                .update({
                    status: 'FAILED',
                    metadata: { ...transaction.metadata, error: error.message }
                })
                .eq('id', transaction.id);

            throw error;
        }
    }
};
