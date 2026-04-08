# Project Overview and Data Flow

## 1. Project Overview

This project is a real-time event-processing backend for industrial IoT data.

Primary goals:
- Ingest high-frequency device events
- Process events asynchronously via stream consumers
- Evaluate dynamic, stateful rules
- Trigger alerts and webhooks with idempotency
- Stream live updates to a frontend dashboard

Tech stack:
- NestJS (modular backend)
- Redis Streams + Redis state (queue + fast in-memory processing)
- PostgreSQL (Supabase) for persistence
- Socket.io for real-time monitoring
- Prisma ORM

Core modules:
- `ingestion`
- `stream`
- `processor`
- `state`
- `rule-engine`
- `actions`
- `rules`
- `alerts`
- `realtime`

## 2. End-to-End Data Flow

1. Device sends event to `POST /events`
2. Ingestion validates payload + API key
3. Event is published to Redis Stream (`events:ingest`)
4. Processor (consumer-group worker) reads stream entry
5. Deduplication check runs (`SET NX EX` in Redis)
6. Ordering policy applies:
   - Slightly out-of-order events are accepted
   - Stale delayed events over threshold are dropped (`event.dropped`)
7. Stateful updates in Redis:
   - sorted set readings
   - last seen
   - aggregates (`avg`, `max`, `spikes`)
8. Rule engine evaluates active JSON DSL rules (count/time windows + heartbeat missing)
9. For matches:
   - alert is persisted in PostgreSQL with dedupe key
   - webhook is called with retry/backoff
   - real-time `alert.created` emitted
10. Real-time updates are pushed to frontend:
   - `event.received`
   - `event.processed`
   - `event.dropped`
   - `device.status`
   - `alert.created`

## 3. Test Coverage and Validation Results

### Automated tests run

1) Backend unit tests  
Command:
```bash
npm test
```
Result: **PASS** (`1/1` suite)

2) Backend e2e tests  
Command:
```bash
npm run test:e2e
```
Result: **FAIL** (default e2e hook timeout)
Reason:
- Current e2e test boots full `AppModule`, which depends on runtime infra (Redis + DB paths)
- Timeout/open handle issue from integration dependencies in test runtime

3) Frontend build verification  
Command:
```bash
npm run build
```
Result: **PASS**

### Runtime smoke validation status

Status by area:
- REST API routes and module wiring: **PASS** (verified during development sessions)
- Rule CRUD + alert CRUD behavior: **PASS** (manually exercised)
- WebSocket event emissions: **PASS** (wired and consumed by frontend)

Environment blockers found during this pass:
- Redis was not reachable on local machine
- Docker daemon not running, so `docker compose up -d redis` failed

Because processor/state/rule streaming rely on Redis, full end-to-end stream tests require:
- Redis running locally (`REDIS_URL=redis://localhost:6379`)  
  or
- an external reachable Redis instance

## 4. Test Cases Checklist

Use this checklist for final acceptance:

### Ingestion
- [ ] `POST /events` accepts valid payload and returns `accepted=true`
- [ ] Invalid payload returns `400`
- [ ] Missing/invalid API key returns `401`

### Rules
- [ ] Create rule (`POST /rules`)
- [ ] List rules (`GET /rules`)
- [ ] Update rule (`POST /rules/:id/update` and/or `PATCH /rules/:id`)
- [ ] Delete rule (`DELETE /rules/:id`)

### Alerts
- [ ] Create manual alert (`POST /alerts`)
- [ ] List alerts (`GET /alerts`)
- [ ] Get by id (`GET /alerts/:id`)
- [ ] Delete (`DELETE /alerts/:id`)

### Streaming and Rule Evaluation
- [ ] Event enters Redis Stream and is consumed by worker
- [ ] Threshold/count window rule triggers alert
- [ ] Time-window rule triggers alert
- [ ] Heartbeat missing rule marks device offline + alert

### Edge Cases
- [ ] Duplicate event dedupe works
- [ ] Out-of-order event handling behaves per policy
- [ ] Delayed stale events are dropped gracefully

### Realtime
- [ ] Frontend receives `event.received`
- [ ] Frontend receives `event.processed`
- [ ] Frontend receives `alert.created`
- [ ] Frontend receives `device.status`

## 5. Prerequisites for Full Test Pass

Before final demo/test run:

1. Start Redis
2. Ensure PostgreSQL/Supabase `DATABASE_URL` and `DIRECT_URL` are valid
3. Run Prisma sync:
```bash
npx prisma db push
```
4. Start backend:
```bash
npm run start:dev
```
5. Start frontend:
```bash
# in smartFacility
npm run dev
```

