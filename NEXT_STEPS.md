# Roadmap & Current State
## Status: In Progress

## Completed Tasks
- [x] Database Schema Design (CLI Migrations)
- [x] WalletService (Atomic Balance Logic)
- [x] Unit Testing (WalletService 6/6 passed)

## Immediate Next Tasks (Phase 4 & 5)
1. [ ] **Orchestration:** Integrate `WalletService.deductBalance` into `ProjectService.generateLandingPage` with full Rollback/Refund logic.
2. [ ] **Orchestration Testing:** Create integration test for `generateLandingPage` ensuring:
     - If generate success -> balance deducted.
     - If generate fails -> balance refunded (atomic rollback).
3. [ ] **Payment Adapter:** Define `PaymentGatewayInterface` and implement `DummyPaymentProvider` for testing.
4. [ ] **Payment Controller:** Create `POST /api/payments/dummy-webhook` for local testing simulation.

## Knowledge Transfer Note
- AI agents reading this: Please review `src/services/wallet.service.js` and `ARCHITECTURE.md` before modifying `ProjectService`. 
- CRITICAL: Ensure `ProjectService` uses a `try-catch` block for orchestrating the billing flow. Rollback MUST be handled if deployment/generation fails.