# queuectl

Lightweight CLI-based job queue (Node.js) — project for background job processing with retries, exponential backoff and a Dead Letter Queue (DLQ).

## Quick setup (Windows / PowerShell)

Prerequisites:
- Node.js (16+)
- MongoDB running locally or a MongoDB URI in `.env`

1. Install dependencies:
```powershell
npm install
```

2. Start MongoDB (if installed as service):
```powershell
Start-Service -Name mongod
```

3. Start the API server (in one terminal):
```powershell
node server.js
```

4. Enqueue a job (safe: use a JSON file):
Create `job.json`:
```json
{ "id": "job1", "command": "echo Hello from job1" }
```
Then:
```powershell
node cli.js enqueue job.json
```

Or enqueue inline with a here-string:
```powershell
$payload = @'
{"id":"job2","command":"echo Hello2"}
'@
node cli.js enqueue $payload
```

5. Start a worker (in another terminal):
```powershell
node worker.js
```
To start multiple workers:
```powershell
node worker.js --count 3
```
Stop a worker gracefully: press `Ctrl+C` in the worker terminal.

6. Check status and list jobs:
```powershell
node cli.js status
node cli.js list
```

7. DLQ operations:
```powershell
node cli.js dlq list
node cli.js dlq retry <jobId>
```

8. Change configuration (retry/backoff):
```powershell
node cli.js config set --retryBase 2 --defaultMaxRetries 3
```

## Files of interest
- `server.js` — Express API and MongoDB connection
- `cli.js` — CLI commands (enqueue, worker start, status, list, dlq, config)
- `worker.js` — Worker loop to pick and run jobs
- `services/queueService.js` — Core queue operations and retry logic
- `models/Job.js` — Mongoose model for jobs

## Testing flow (PowerShell)
There is a sample PowerShell test script at `scripts/test_flow.ps1` that enqueues a success job and a failing job, starts a background worker, waits for retries, then prints status and DLQ.

## Architecture notes
- Jobs stored in MongoDB (persistent)
- Workers atomically claim jobs using `findOneAndUpdate`
- Exponential backoff: `delay = retryBase ^ attempts` seconds (configurable)
- Jobs exceeding `max_retries` move to `dead` state (DLQ)

## Assumptions & trade-offs
- Uses MongoDB for persistence (simple and reliable for this task)
- Worker stop is implemented via SIGINT (Ctrl+C). A PID manager can be added if background service management is required.

If you want, I can add automated tests or a `worker stop` helper that manages PIDs.
# queuectl — MVC Node + Express + MongoDB

A minimal MVC-style Node.js + Express implementation of a CLI-based job queue system with:
- multiple workers
- exponential backoff retries
- Dead Letter Queue (DLQ)
- persistent storage using MongoDB
- simple HTTP management API and CLI wrapper

## Setup

1. Clone or unzip the project.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and edit if needed.
4. Start MongoDB (local `mongod` or provide Atlas connection string in `.env`).
5. Start API:
   ```
   npm run start
   ```
6. Start worker(s):
   ```
   node worker.js --count 2
   ```
7. Enqueue jobs:
   ```
   node cli.js enqueue '{"command":"echo hello"}'
   ```

## API
- `POST /enqueue` — enqueue a job (JSON body: `{ "command": "...", "id": "...", "max_retries": 3 }`)
- `GET /list?state=pending` — list jobs by state
- `GET /status` — stats
- `GET /dlq` — list dead jobs
- `POST /dlq/retry/:id` — retry a dead job

## Notes
- Retry backoff is `delay = base ^ attempts` seconds (configurable via `RETRY_BASE`).
- Jobs move to `dead` after exhausting `max_retries`.
- Persistence is via MongoDB.

## Testing
Run `npm run test-flow` (ensure API is running and `jq` is installed) and observe worker logs in another terminal.

