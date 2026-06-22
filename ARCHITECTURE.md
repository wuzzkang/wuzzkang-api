# WuzzKang Architecture
WuzzKang is a modular monolith SaaS platform designed for high-concurrency AI-generated landing page deployment.

## 1. High-Level System Architecture
The system relies on an "Orchestration" layer to ensure financial safety and deployment reliability. The core architecture splits generation (free) from deployment (paid).

```mermaid
graph TD
    Client[Client Request] --> Controller[API Layer / Orchestrator]
    
    subgraph Orchestration Layer
        Controller -->|1. Generate Draft (Free)| Generator[GeneratorService]
        Controller -->|2. Validate & Deploy| Project[ProjectService]
        Project -->|3. Deduct Balance| Wallet[WalletService]
        Project -->|4. Queue Job| RedisQueue[BullMQ Queue]
    end
    
    Wallet --> DB[(Supabase PostgreSQL)]
    Generator --> DB
    RedisQueue --> Worker[DeployWorker]
    Worker --> Ext[External APIs: GitHub]
    Worker --> DB
    Worker -->|Error/Rollback| Wallet
```

## 2. Core Architectural Patterns
* **C. Adapter Pattern (Extensibility & Environment Switching):**
  - Providers implement `PaymentGatewayInterface`.
  - `PaymentFactory` acts as the Service Locator.
  - Logic: 
    - `DummyProvider`: Returns hardcoded success; used for local development and integration tests.
    - `WinpayProvider`: Uses RSA-SHA256 signing; used in production.
  - Signing Strategy: 
    - Winpay requests require RSA signing (Private Key).
    - Winpay callbacks require RSA verification (Public Key).

## 3. Tech Stack

| Layer | Technology |
| --- | --- |
| **Backend** | Node.js (TypeScript/ESM) |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Async** | Redis + BullMQ |
| **Deployment** | Docker / Linux (VPS) |

## 4. API Strategy

* **Communication:** RESTful APIs for all internal and external communication.
* **Validation:** Zod schemas are mandatory for all input payloads (Request Bodies, Query Params).
* **Error Handling:** Standardized error responses (4xx for Client, 5xx for Server) with clear error codes.
* **Optimization:** List endpoints exclude heavy payload fields (like `page_data`) to ensure fast response times and low memory footprints.

## 5. Security & Authentication

* **Authentication:** Supabase Auth (JWT-based).
* **Authorization:** Row Level Security (RLS) is enabled on all tables.
* **Data Protection:** No hardcoded secrets; use `process.env`.
* **Rate Limiting:** Implemented at the API Gateway/Controller level to prevent abuse of the AI generation endpoint.

## 6. Orchestration Logic (Financial Safety)

To prevent balance leakage during deployments:

1. **Synchronous Validation:** Verify the project status is `draft` (or `failed`) and the GitHub repository name is available via GitHub API.
2. **Deduct:** Call `WalletService.deductBalance` (Atomic). Fails fast if funds are insufficient.
3. **Queue:** Push the job to BullMQ (`deployment-queue`) and update project status to `deploying`.
4. **Worker Execution:** 
    - Worker clones the template repo, updates content, and activates GitHub Pages.
    - Resolves exact static URL string (`live_url`) and saves to Supabase.
5. **Rollback Strategy:**
    - If queue fails to add the job, synchronous refund is issued immediately.
    - If worker fails permanently after 3 retries (unrecoverable error), it updates status to `failed` and issues an asynchronous refund via `WalletService.addTransaction`.
