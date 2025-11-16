# QueueCTL

QueueCTL is a lightweight CLI-based job queue system built with Node.js + Express + MongoDB. It supports:

- Multiple workers
- Job retries with exponential backoff
- Dead Letter Queue (DLQ) for permanently failed jobs
- Persistent storage (MongoDB)
- CLI and optional web dashboard for interactive control

Demo video: https://drive.google.com/file/d/1CQtQcU_m4BzDivMcSNXcIzHJJILjN2ik/view?usp=sharing

---

Table of contents
- Quick Setup
- Job Lifecycle
- CLI Commands
- API Endpoints
- Frontend Dashboard
- Configuration
- Testing
- Architecture Overview
- Example API Responses
- Assumptions & Trade-offs


---

## Quick Setup (Windows / PowerShell and Linux/macOS guidance)

### Prerequisites
- Node.js v16+ (recommended latest LTS)
- MongoDB (local or Atlas URI)


Clone repository (if you have a remote repo):
```bash
git clone <your-repo-url>
cd <repo-folder>
```

1. Install dependencies
```bash
npm install
```

2. Configure environment

Create a `.env` at repository root. Example:
```text
# .env
MONGODB_URI=mongodb://localhost:27017/queuectl
PORT=3000
RETRY_BASE=2
DEFAULT_MAX_RETRIES=3
```

For the frontend (optional), create `frontend/.env`:
```text
VITE_API_URL=http://localhost:3000
```

3. Start MongoDB
- Windows (if running as a service):
```powershell
Start-Service -Name mongod
```
- Linux/macOS (systemd):
```bash
sudo systemctl start mongod
```
- Or run via Docker:
```bash
docker run --name queuectl-mongo -p 27017:27017 -d mongo:6
```

4. Start the API server
```bash
node server.js
# or for development
npm run dev
```

5. Start worker(s)

Foreground (use ctrl+C to stop):
```bash
node worker.js           # Start 1 worker
node worker.js --count 3 # Start 3 workers
```

Detached/background (writes PID to worker.pid):
```bash
queuectl worker start --count 2 --detach
# Stop detached worker
queuectl worker stop
```

6. Enqueue jobs

Inline (PowerShell single-quote works well):
```powershell
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'
```

From a JSON file (recommended to avoid quoting issues):
```bash
# job.json
{ "id": "job2", "command": "echo Hello2" }

# enqueue
queuectl enqueue job.json
```

7. Check status and list jobs
```bash
queuectl status
queuectl list
```

8. DLQ operations
```bash
queuectl dlq list
queuectl dlq retry <jobId>
```

9. Configuration
```bash
queuectl config set --retryBase 2 --defaultMaxRetries 3
```

---

## Job Lifecycle

States and descriptions:

- pending — Waiting to be picked up by a worker
- processing — Currently being executed
- completed — Successfully executed
- failed — Failed, but retryable
- dead — Permanently failed (moved to DLQ)

Retry/backoff:
- Exponential backoff: delay = retryBase ** attempts (seconds)
- Max retries: configurable per-job via `max_retries` or via global default

---

## CLI Commands

Common commands:

- Enqueue a job:
  queuectl enqueue '{"id":"job1","command":"sleep 2"}'

- Start workers (foreground):
  queuectl worker start --count 3

- Start workers (background/detach):
  queuectl worker start --count 2 --detach

- Stop detached workers:
  queuectl worker stop

- Status summary:
  queuectl status

- List jobs (by state):
  queuectl list --state pending

- DLQ operations:
  queuectl dlq list
  queuectl dlq retry <jobId>

- Config:
  queuectl config set --retryBase 2 --defaultMaxRetries 3

Example CLI usage and sample outputs (simulated)
```bash
# Enqueue
$ queuectl enqueue '{"id":"job1","command":"echo Hello"}'
Enqueued job job1 (state=pending)

# Status
$ queuectl status
pending: 1
processing: 0
completed: 0
failed: 0
dead: 0

# List pending jobs
$ queuectl list --state pending
[
  {
    "id": "job1",
    "command": "echo Hello",
    "state": "pending",
    "attempts": 0,
    "max_retries": 3
  }
]
```

---

## API Endpoints

- POST /enqueue
  - Body: { command, id?, max_retries? }
  - Adds a new job to the queue

- GET /list?state=pending
  - Returns jobs filtered by state

- GET /status
  - Returns job statistics by state

- GET /dlq
  - List jobs with state `dead`

- POST /dlq/retry/:id
  - Retry job from DLQ (moves job out of DLQ, resets attempts)

- POST /config
  - Body: { retryBase, defaultMaxRetries }
  - Update retry/backoff config

Example API JSON response (simulated)
```json
{
  "id": "unique-job-id",
  "command": "echo 'Hello World'",
  "state": "pending",
  "attempts": 0,
  "max_retries": 3,
  "created_at": "2025-11-04T10:30:00Z",
  "updated_at": "2025-11-04T10:30:00Z"
}
```

---

## Frontend Dashboard

Optional React + Vite + Tailwind dashboard located in `frontend/`. Features:
- Enqueue job
- View jobs by state
- View DLQ jobs
- Retry DLQ jobs
- Auto-refresh on enqueue/retry

Make sure `frontend/.env` contains:
```
VITE_API_URL=http://localhost:3000
```

Run frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

- Retry base and default max retries can be set in `.env` or via the `queuectl config` command/API.
- Backoff formula used: delay = retryBase ** attempts (in seconds)
- Example default config:
  - RETRY_BASE=2
  - DEFAULT_MAX_RETRIES=3

---

## Testing

A PowerShell test flow is included at `scripts/test_flow.sh` (or `scripts/test_flow.ps1` for PowerShell). Purpose:
- Enqueue a success job and a failing job
- Start background worker
- Wait for retries and inspect DLQ

Example test steps (manual):
1. Ensure server is running (`node server.js`).
2. Run the test script:
   - Windows PowerShell: `.\scripts\test_flow.ps1`
   - Unix/macOS: `bash scripts/test_flow.sh`
3. Expected behavior:
   - The successful job completes quickly.
   - The failing job is retried according to exponential backoff and eventually moved to DLQ when attempts exceed max_retries.
4. Verify:
```bash
# After test completes
queuectl status
queuectl dlq list
```

Sample expected test output (simulated)
```text
Enqueued job job-success (state=pending)
Enqueued job job-fail (state=pending)
Worker started (pid=12345)
job-success -> completed
job-fail -> failed (attempt 1) (retry in 2s)
...
job-fail -> dead (moved to DLQ after 3 attempts)
DLQ:
- job-fail
```

---

## Architecture Overview

- Backend
  - Node.js + Express REST API
  - Mongoose models for persistent job storage in MongoDB
- Workers
  - Worker process polls DB and atomically claims a pending job (findOneAndUpdate)
  - Executes the job's `command` (shell execution) and updates job state
  - On failure, increments attempts and schedules retry based on exponential backoff
  - If attempts > max_retries => job moved to `dead` state (DLQ)
- DLQ
  - Jobs with `state: dead` are listed in DLQ endpoints
  - DLQ jobs can be retried (reset attempts and state reset to `pending`)
- Concurrency
  - Multiple worker processes can run concurrently
  - Atomic claim prevents duplicate processing
- Persistence
  - MongoDB stores job documents and persists state across restarts

Data model (high-level)
```json
{
  "id": "jobId",
  "command": "string",
  "state": "pending|processing|completed|failed|dead",
  "attempts": 0,
  "max_retries": 3,
  "next_run_at": "ISODate",
  "last_error": "string | null",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

---

## Assumptions & Trade-offs

Assumptions:
- Jobs are simple shell commands (string) and safe to execute in your environment.
- The system runs in a trusted environment. No sandboxing is provided.
- Workers execute commands synchronously and rely on exit codes to determine success/failure.
- Job uniqueness can be optionally provided via `id` but duplicates are not automatically deduplicated unless enforced.

Trade-offs:
- Simplicity over full enterprise features: no job scheduling calendar, no per-job resource limits, no built-in security sandbox.
- Shell command execution gives great flexibility but also increases security risk if untrusted commands are enqueued.
- Using MongoDB as a queue backend is simple and reliable for small-to-medium scale, but at very high throughput a dedicated queue (RabbitMQ, Kafka, Redis Streams) may be more suitable.
- DLQ is simple: jobs marked `dead`, retriable via API/CLI. No advanced DLQ routing implemented.

---




