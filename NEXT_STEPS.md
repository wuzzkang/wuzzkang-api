# WuzzKang API - Project Roadmap

## Phase 1-4: Foundation & Orchestration (Completed)
- [x] Base project structure (Express + ESM).
- [x] WalletService (Atomic transactions).
- [x] ProjectService (Orchestration logic).
- [x] Unit testing with Jest.

## Phase 5: Payment Gateway Integration (Completed)
- [x] Adapter Pattern implemented (`interface.js`).
- [x] Dummy Payment Provider (`dummy.provider.js`).
- [x] Payment Factory implementation (`factory.js`).
- [x] Webhook Controller (`payment.controller.js`) & Error Handling.
- [x] API Routes registered (`/api/payments/webhook`).

## Phase 5b: Payment Testing (Current Focus)
- [x] Implement E2E Integration Test (`src/tests/payment.integration.test.js`).
    - Setup: Create dummy profile in DB.
    - Test: Hit webhook with valid UUID and signature.
    - Verify: Check wallet balance increment.
    - Cleanup: Delete dummy profile.

## Phase 6: Real Provider & Frontend (Next)
- [ ] Implement `MidtransProvider` (or preferred provider) extending `PaymentGatewayInterface`.
- [ ] Update `PaymentFactory` to support environment-based provider switching.
- [ ] Frontend Integration: Connect checkout flow to API.
- [ ] Security Hardening: Implement IP Whitelisting for webhooks.