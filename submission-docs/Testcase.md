Smart Facility – Test Cases
🔹 1. Event Ingestion (Single)

Test Case ID: TC_001
Endpoint: POST /events

Input:

{
  "deviceId": "device-001",
  "type": "temperature",
  "value": 25.5,
  "timestamp": 1744185600
}

Expected Result:

Status: 201 Created
Event pushed to Redis stream
Socket emits: event.received
Event appears in dashboard
🔹 2. Batch Event Ingestion

Test Case ID: TC_002
Endpoint: POST /events/batch

Input:

[
  { "deviceId": "device-002", "type": "temperature", "value": 24.1, "timestamp": 1744185601 },
  { "deviceId": "device-001", "type": "temperature", "value": 22.5, "timestamp": 1744185600 }
]

Expected Result:

Status: 201 Created
Response contains:
accepted: true
streamId
All events added to Redis stream
Visible in live feed
🔹 3. Invalid API Key

Test Case ID: TC_003

Input:

Missing or wrong x-api-key

Expected Result:

Status: 401 Unauthorized
Error: "Invalid API key"
🔹 4. Invalid Payload (Validation Fail)

Test Case ID: TC_004

Input:

{
  "deviceId": "",
  "value": "invalid"
}

Expected Result:

Status: 400 Bad Request
Validation error message
🔹 5. Deduplication Check

Test Case ID: TC_005

Steps:

Send same event twice

Expected Result:

First → processed
Second → dropped
Socket emits:
event.processed
event.dropped
🔹 6. Out-of-Order Event Handling

Test Case ID: TC_006

Steps:

Send timestamp: 1744185605
Then send older timestamp: 1744185600

Expected Result:

Older event ignored/dropped
No incorrect state update
🔹 7. Rule Creation

Test Case ID: TC_007
Endpoint: POST /rules

Input:

{
  "name": "High Temp",
  "eventType": "temperature",
  "definition": {
    "operator": ">",
    "threshold": 30,
    "window": { "type": "count", "value": 2 },
    "action": "ALERT"
  },
  "isActive": true
}

Expected Result:

Rule saved in DB
Rule appears in UI
🔹 8. Rule Trigger → Alert Creation

Test Case ID: TC_008

Steps:

Create rule: temp > 30 (2 times)
Send:
31.2
32.1

Expected Result:

Alert created
Stored in Postgres
Socket emits: alert.created
Appears in dashboard
🔹 9. Webhook Retry Mechanism

Test Case ID: TC_009

Steps:

Configure invalid webhook URL

Expected Result:

Retry with backoff
Logs show retry attempts
Eventually fails gracefully
🔹 10. Device Status Tracking

Test Case ID: TC_010

Steps:

Send event → device online
Stop sending events

Expected Result:

Device becomes offline
Socket emits: device.status
🔹 11. Redis Down Scenario

Test Case ID: TC_011

Steps:

Stop Redis
Send event

Expected Result:

Graceful warning (no crash)
API may reject or degrade
🔹 12. Full End-to-End Flow ✅ (MOST IMPORTANT)

Test Case ID: TC_012

Steps:

Create rule
Send batch events (Postman)
Processor consumes events
Rule evaluates
Alert created
UI updates

Expected Result:

Full pipeline works:

Ingest → Redis → Processor → Rule → Alert → DB → Socket → UI