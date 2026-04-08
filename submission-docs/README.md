# Smart Facility Submission Docs

This folder contains assignment-ready documentation and API artifacts.

## Architecture Diagram (must-have)

```mermaid
flowchart LR
  subgraph Producers
    DEV[IoT Devices and Simulators]
    PM[Postman and scripts]
  end

  subgraph API[Smart Facility Backend - NestJS]
    ING[Ingestion Controller and Service]
    STRM[Redis Stream events:ingest]
    PROC[Processor Worker and Consumer Group]
    STATE[State Service]
    RULE[Rule Engine]
    ACT[Actions Service]
    WS[Realtime Gateway Socket.io]
  end

  subgraph DataStores
    REDIS[(Redis)]
    PG[(Postgres or Supabase)]
  end

  UI[React Dashboard]
  WEBHOOK[External Webhook]

  DEV -->|POST /events| ING
  PM -->|POST /events/batch| ING
  ING -->|validate and auth| STRM
  ING -->|event.received| WS

  STRM --> PROC
  PROC -->|dedupe and ordering checks| REDIS
  PROC -->|write event log| PG
  PROC --> STATE

  STATE -->|last seen and rolling windows| REDIS
  STATE --> RULE
  RULE -->|if matched| ACT

  ACT -->|create alert| PG
  ACT -->|retry with backoff| WEBHOOK

  PROC -->|event.processed or event.dropped| WS
  ACT -->|alert.created| WS
  STATE -->|device.status online or offline| WS

  WS --> UI
```

## Key Decisions and Trade-offs

- **NestJS modular architecture**
  - Decision: split by domain (`ingestion`, `processor`, `rules`, `alerts`, `realtime`, etc.).
  - Trade-off: more files and wiring, but cleaner ownership and testability.

- **Redis Streams for ingestion queue**
  - Decision: decouple API write path from processing using consumer groups.
  - Trade-off: operational dependency on Redis; if Redis is unavailable, stream-based flow is degraded.

- **Redis for hot state + Postgres for durable records**
  - Decision: keep high-churn state in Redis, durable entities/events in Postgres.
  - Trade-off: dual-storage consistency complexity, but better performance for rule windows.

- **JSON DSL for rule definitions**
  - Decision: rules configurable at runtime via database JSON.
  - Trade-off: requires stronger validation and careful versioning of rule schema.

- **Realtime via Socket.io**
  - Decision: emit domain events (`event.received`, `event.processed`, `alert.created`, `device.status`) for dashboard UX.
  - Trade-off: additional connection management and event contract maintenance.

- **POST fallback for updates (`/rules/:id/update`)**
  - Decision: support POST update route in addition to PATCH for easier browser/CORS and client compatibility.
  - Trade-off: less strictly RESTful, but simpler integration across tools.

## Included in this folder

- `README.md` (this file)
- `api/API_DOCS.md`
- `api/smart-facility.postman_collection.json`
- `api/local.postman_environment.json`

## Quick Run

1. Start infra: `docker compose up -d redis postgres`
2. Start backend in `smart-facility-backend`: `npm run start:dev`
3. Use Postman files from `submission-docs/api`
