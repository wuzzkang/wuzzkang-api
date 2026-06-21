import { Router } from 'express';
import { handleWebhook } from '../controllers/payment.controller.js';

const router = Router();

/**
 * POST /api/payments/webhook
 * Handles inbound payment gateway webhook notifications.
 * This route is intentionally provider-agnostic via the PaymentFactory.
 */
router.post('/payments/webhook', handleWebhook);

export default router;
