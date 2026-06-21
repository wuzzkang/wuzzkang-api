# WuzzKang API - Project Roadmap

## Phase 6: Winpay Production-Ready Integration (In Progress)

### Task 6.1: Setup & Configuration
- [ ] Define RSA keys in `.env` (`OUR_PRIVATE_KEY`, `WINPAY_PUBLIC_KEY`).
- [ ] Add `WINPAY_PARTNER_ID` to `.env`.
- [ ] Update `PaymentGatewayInterface` to include `verifyCallback(payload, signature)`.

### Task 6.2: WinpayProvider Core (Signing)
- [ ] Implement `src/services/payments/winpay.provider.js`.
- [ ] Implement `generateSignature(payload)` using RSA-SHA256.
- [ ] Create unit tests for signature generation to match Winpay docs.

### Task 6.3: WinpayProvider Implementation (API)
- [ ] Implement `createTransaction()` (VA/QRIS) in `WinpayProvider`.
- [ ] Implement `verifyCallback()` logic using `WINPAY_PUBLIC_KEY`.

### Task 6.4: PaymentFactory Orchestration
- [ ] Refactor `factory.js` to check `NODE_ENV`.
- [ ] Return `WinpayProvider` if `NODE_ENV === 'production'`.
- [ ] Return `DummyPaymentProvider` otherwise.

### Task 6.5: Security & Verification
- [ ] Add IP Whitelisting middleware for `/api/payments/webhook`.
- [ ] Full Integration Test (Mocking Winpay sandbox behavior).