# API Docs and Postman Guide

Base URL: `http://localhost:3000`

## Required Headers

- `Content-Type: application/json`
- `x-api-key: <API_KEY from backend .env>` for:
  - `POST /events`
  - `POST /events/batch`

## Endpoints

### Events

- `POST /events`
  - Body: single event object
  - Example:
    ```json
    {
      "deviceId": "device-001",
      "type": "temperature",
      "value": 22.5,
      "timestamp": 1744185600
    }
    ```

- `POST /events/batch`
  - Body can be either:
    1) raw JSON array of events
    2) object wrapper `{ "events": [ ... ] }`
  - Example:
    ```json
    [
      { "deviceId": "device-002", "type": "temperature", "value": 24.1, "timestamp": 1744185601 },
      { "deviceId": "device-001", "type": "temperature", "value": 22.5, "timestamp": 1744185600 },
      { "deviceId": "device-003", "type": "temperature", "value": 31.2, "timestamp": 1744185602 }
    ]
    ```

### Rules

- `POST /rules`
- `GET /rules`
- `GET /rules/:id`
- `PATCH /rules/:id`
- `POST /rules/:id/update`
- `DELETE /rules/:id`

### Alerts

- `POST /alerts`
- `GET /alerts`
- `GET /alerts/:id`
- `DELETE /alerts/:id`

## Postman Files in this folder

- `smart-facility.postman_collection.json`
- `local.postman_environment.json`

## How to use Postman quickly

1. Import both files.
2. Select environment `Smart Facility Local`.
3. Set `apiKey` variable to match backend `.env` value.
4. Run in sequence:
   - `Rules - Create`
   - `Events - Ingest` (or call `/events/batch` manually)
   - `Alerts - List`

## Common Errors

- `401 Invalid API key`
  - `x-api-key` missing or does not match backend `API_KEY`.
- `Validation failed (parsable array expected)`
  - Request body was not a JSON array/object accepted by batch endpoint.
  - In Postman use Body -> raw -> JSON.
- Redis connection errors
  - Start Redis (`docker compose up -d redis`) or set valid `REDIS_URL`.
