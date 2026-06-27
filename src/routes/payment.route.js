import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { webhookController } from '../controllers/webhook.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * POST /api/payments/create
 * Initiates a new payment transaction.
 */
router.post('/payments/create', authMiddleware, paymentController.createTransaction);

/**
 * POST /api/payment/webhook/* and /api/payments/webhook/*
 * Handles inbound payment gateway webhook notifications with dynamic paths.
 * Supports both /payment and /payments prefixes and channel-specific paths.
 */
router.post(/^\/payments?\/webhook.*/, webhookController.handleWinpayWebhook);

export default router;
