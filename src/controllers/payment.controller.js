import { transactionService } from '../services/transaction.service.js';

/**
 * Controller for handling payment-related requests.
 */
export const paymentController = {
    /**
     * Creates a new payment transaction.
     */
    async createTransaction(req, res) {
        const { amount, userId, channel } = req.body;

        if (!amount || !userId || !channel) {
            return res.status(400).json({ error: 'Missing required fields: amount, userId, channel' });
        }

        try {
            const result = await transactionService.createTransaction(amount, userId, channel);
            return res.status(200).json(result);
        } catch (error) {
            console.error(`[PaymentController] createTransaction error: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
};
