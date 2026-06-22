# WuzzKang API - Project History

Dokumen ini berisi catatan perubahan dan fitur yang telah diimplementasikan dalam proyek WuzzKang API.

## Phase 1-4: Foundation & Orchestration
- [x] Base project structure (Express + ESM).
- [x] WalletService (Atomic transactions implementation).
- [x] ProjectService (Orchestration logic & AI generation flow).
- [x] Unit testing with Jest for core services.

## Phase 5: Payment Gateway Integration (Adapter Pattern)
- [x] Defined `PaymentGatewayInterface` for provider-agnostic implementation.
- [x] Implemented `DummyPaymentProvider` for local testing/development.
- [x] Implemented `PaymentFactory` for provider management.
- [x] Built `payment.controller.js` for secure Webhook handling.
- [x] Registered `/api/payments/webhook` route in the API Gateway.

## Phase 5b: Payment Testing (Automation)
- [x] Implemented E2E Integration Test (`src/tests/payment.integration.test.js`).
    - Automated Setup: Creating dummy profile in Supabase.
    - Automated Test: Webhook hit + Signature verification.
    - Automated Verify: Wallet balance increment.
    - Automated Cleanup: Profile removal.
- [x] Created `scripts/seed-user.js` for local development data seeding.
- [x] Optimized testing environment with `nvm use 24` and `experimental-vm-modules`.

## Phase 6: Core Deployment Features
- [x] Separated Generation and Deployment flows for safer User Experience (Free Generate, Paid Deploy).
- [x] Replaced `POST /projects` with `POST /generate` (saves project as draft) and `POST /projects/:id/deploy` (deducts balance and queues deployment).
- [x] Implemented robust error handling: Synchronous GitHub repo name validation to prevent balance deduction on collision.
- [x] Added `live_url` storage mapping to predict and store GitHub Pages URL reliably.
- [x] Auto-refund mechanism in BullMQ worker for unrecoverable background deployment failures.
- [x] Added GitHub Pages explicit retry endpoint `POST /projects/:id/retry-pages`.
- [x] Optimized `GET /projects` list endpoint payload to exclude heavy `page_data` JSON.