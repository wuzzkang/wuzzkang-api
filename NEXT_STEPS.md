# WuzzKang API - Project Roadmap

## Phase 5c: Infrastructure Hardening
- [x] Task 5.5: Implement Idempotency (Database Constraint & Check-then-Act Logic).

## Phase 6: Winpay Production-Ready Integration
- [x] Task 6.1: Setup & Configuration (RSA keys and Env vars).
- [x] Task 6.2: Implement WinpayProvider Core (Signing).
- [x] Task 6.3: WinpayProvider Implementation (API).
- [ ] Task 6.4: PaymentFactory Orchestration.
- [ ] Task 6.5: Security & Verification (IP Whitelisting).

## Phase 7: Custom Domains & Advanced Deployment
- [ ] Task 7.1: Implement `POST /api/projects/:id/domain` endpoint to handle custom domain purchases.
- [ ] Task 7.2: Orchestration for custom domains: Check availability, deduct balance, and update GitHub Pages via Octokit.
- [ ] Task 7.3: Database updates: Replace `live_url` with custom domain upon successful application.
- [ ] Task 7.4: Automated testing for the custom domain assignment flow.