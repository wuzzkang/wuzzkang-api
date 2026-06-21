# WuzzKang Architecture
WuzzKang is a modular monolith SaaS platform designed for high-concurrency AI-generated landing page deployment.

## 1. High-Level System Architecture
The system relies on an "Orchestration" layer to ensure financial safety and deployment reliability.

```mermaid
graph TD
    Client[Client Request] --> Controller[API Layer / Orchestrator]
    
    subgraph Orchestration Layer
        Controller -->|1. Validate| Wallet[WalletService]
        Controller -->|2. Generate| Project[ProjectService]
        Project -->|Error/Rollback| Wallet
    end
    
    Wallet --> DB[(Supabase Postgre)]
    Project --> Ext[External APIs: GitHub/OpenAI]
    
    subgraph "Core Patterns"
        Wallet
        Project
    end
```

## 2. Core Architectural Patterns

These patterns are non-negotiable standards for system consistency:

* **A. Billing Engine (Atomic Transactions):**
* All financial operations must be atomic.
* Every deduction/credit must be wrapped in a database transaction.
* If `ProjectService` fails, the `WalletService` MUST trigger a rollback (refund).


* **B. Migration Workflow (Infrastructure as Code):**
* Database schema changes are managed via `supabase migration new`.
* Manual SQL edits via UI are strictly prohibited.
* `supabase db push` is the only mechanism for deployment.


* **C. Adapter Pattern (Extensibility):**
* Payment providers must implement a common interface.
* Always implement `DummyProvider` first for local testing/CI before connecting to production providers (Midtrans/Xendit).



## 3. Tech Stack

| Layer | Technology |
| --- | --- |
| **Backend** | Node.js (TypeScript) |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Async** | Redis + BullMQ |
| **Deployment** | Docker / Linux (VPS) |

## 4. API Strategy

* **Communication:** RESTful APIs for all internal and external communication.
* **Validation:** Zod schemas are mandatory for all input payloads (Request Bodies, Query Params).
* **Error Handling:** Standardized error responses (4xx for Client, 5xx for Server) with clear error codes.

## 5. Security & Authentication

* **Authentication:** Supabase Auth (JWT-based).
* **Authorization:** Row Level Security (RLS) is enabled on all tables.
* **Data Protection:** No hardcoded secrets; use `process.env`.
* **Rate Limiting:** Implemented at the API Gateway/Controller level to prevent abuse of the AI generation endpoint.

## 6. Orchestration Logic (Financial Safety)

To prevent balance leakage:

1. **Validate:** Check User Balance in `profiles`.
2. **Deduct:** Call `WalletService.deductBalance` (Atomic).
3. **Execute:** Run `ProjectService` generation.
4. **Finalize/Rollback:**
* If success: Commit transaction.
* If fail: Issue a refund transaction in `WalletService` to return 10.000 credits to user.
