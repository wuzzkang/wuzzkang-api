# WuzzKang API

WuzzKang API is the robust backend orchestration engine for the WuzzKang SaaS platform. It handles AI landing page generation, financial transactions (wallet/balances), and automated GitHub Pages deployments.

## Features

- **Decoupled Generation & Deployment:** Users can generate AI landing pages for free and save them as drafts. Deployments to GitHub Pages are handled via a paid endpoint, deducting balance safely before execution.
- **Robust Orchestration:** Implements the Orchestration Pattern with atomic database transactions to ensure user balance safety. Built-in mechanisms for synchronous repository validation and asynchronous BullMQ refunds on deployment failure.
- **Payment Gateway Integration:** Adapter Pattern implemented for payment gateways (Winpay for production, Dummy for local testing) to support future extensibility.
- **Background Jobs:** Utilizes Redis and BullMQ for high-concurrency background deployments to GitHub.
- **Supabase Integration:** Powered by Supabase for PostgreSQL, Row Level Security (RLS), and Authentication.

## Getting Started

### Prerequisites
- Node.js v24 (`nvm use 24`)
- Redis (running locally or remote)
- Supabase (Local CLI or Remote Project)
- GitHub Personal Access Token (for Octokit)

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials.

3. Start the development server:
```bash
npm run dev
```

## Project Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level system architecture and patterns.
- [HISTORY.md](./HISTORY.md) - Changelog and completed features.
- [NEXT_STEPS.md](./NEXT_STEPS.md) - Project roadmap and upcoming tasks.
- [agent-instructions.md](./agent-instructions.md) - Development rules and protocols.

## License
MIT
