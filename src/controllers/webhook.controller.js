import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { PaymentFactory } from '../services/payments/factory.js';
import { walletService } from '../services/wallet.service.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

/**
 * Controller for handling payment webhooks.
 */
export const webhookController = {
    /**
     * Handles Winpay SNAP Webhook/Callback.
     */
    async handleWinpayWebhook(req, res) {
        const payload = req.body;
        const signature = req.headers['x-signature'];
        const timestamp = req.headers['x-timestamp'];

        console.log(`[WebhookController] Received webhook for order ${payload.trxId}`);

        try {
            // 1. Verify Signature
            const provider = await PaymentFactory.getProvider();
            const isValid = provider.verifyWebhook(payload, signature, req.method, req.originalUrl, timestamp, req.rawBody);

            if (!isValid) {
                console.error(`[WebhookController] Invalid signature for order ${payload.trxId}`);
                const responsePayload = {
                    responseCode: '4012700',
                    responseMessage: 'Invalid Signature'
                };

                if (provider.lastVerificationError) {
                    responsePayload.debugInfo = provider.lastVerificationError;
                }

                return res.status(401).json(responsePayload);
            }

            // 2. Find Transaction
            const { data: transaction, error: findError } = await supabase
                .from('transactions')
                .select('*')
                .eq('order_id', payload.trxId)
                .single();

            if (findError || !transaction) {
                console.error(`[WebhookController] Transaction not found: ${payload.trxId}`);
                return res.status(404).json({
                    responseCode: '4042700',
                    responseMessage: 'Transaction Not Found'
                });
            }

            // 3. Check if already processed
            if (transaction.status === 'PAID') {
                console.log(`[WebhookController] Transaction ${payload.trxId} already PAID`);
                return res.status(200).json(provider.getSuccessResponse(payload));
            }

            // 4. Determine status from payload
            // SNAP standard: responseCode starting with '200' usually means success
            // Some Winpay callbacks might not have responseCode but have paidAmount
            const isSuccess = (payload.responseCode && payload.responseCode.startsWith('200')) ||
                (payload.paidAmount && payload.paidAmount.value);

            const newStatus = isSuccess ? 'PAID' : (payload.responseCode === '4012701' ? 'EXPIRED' : 'FAILED');

            console.log(`[WebhookController] Updating transaction ${payload.trxId} to status ${newStatus}`);

            // 5. Update Status and Balance if PAID
            if (newStatus === 'PAID') {
                await walletService.completeTransaction(transaction.id);
            } else {
                await supabase
                    .from('transactions')
                    .update({
                        status: newStatus,
                        metadata: { ...transaction.metadata, webhook: payload }
                    })
                    .eq('id', transaction.id);
            }

            // 6. Return Success to Winpay
            return res.status(200).json(provider.getSuccessResponse(payload));
        } catch (error) {
            console.error(`[WebhookController] Error processing webhook: ${error.message}`);
            return res.status(500).json({
                responseCode: '5002700',
                responseMessage: 'Internal Server Error'
            });
        }
    }
};
