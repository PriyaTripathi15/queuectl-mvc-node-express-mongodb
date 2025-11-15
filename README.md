# QueueCTL

**QueueCTL** is a lightweight CLI-based job queue system built with **Node.js + Express + MongoDB**, supporting:

- Multiple workers  
- Job retries with exponential backoff  
- Dead Letter Queue (DLQ) for permanently failed jobs  
- Persistent storage  
- CLI and optional web dashboard for interactive control  

---

## Table of Contents

- [Quick Setup](#quick-setup)  
- [Job Lifecycle](#job-lifecycle)  
- [CLI Commands](#cli-commands)  
- [API Endpoints](#api-endpoints)  
- [Frontend Dashboard](#frontend-dashboard)  
- [Configuration](#configuration)  
- [Testing](#testing)  
- [Architecture Overview](#architecture-overview)  
- [Example API Responses](#example-api-responses)  
- [Assumptions & Trade-offs](#assumptions--trade-offs)  
- [Evaluation & Notes](#evaluation--notes)  

---

## Quick Setup (Windows / PowerShell)

### Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas URI)
- Optional: `jq` CLI for JSON formatting (useful for scripting)

### Steps

1. Install dependencies

```powershell
npm install
```

2. Start MongoDB (if installed as a Windows service)

```powershell
Start-Service -Name mongod
```

3. Start the API server (in one terminal)

```powershell
node server.js
```

4. Start worker(s) (in another terminal)

Foreground (ctrl+C to stop):
```powershell
node worker.js           # Start 1 worker
node worker.js --count 3 # Start 3 workers
```

Detached/background (writes PID to `worker.pid`):
```powershell
queuectl enqueue  worker start --count 2 --detach
# Stop detached worker
queuectl worker stop
```

5. Enqueue jobs

Inline (PowerShell single-quote works well):
```powershell
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'
```

From a JSON file (recommended to avoid quoting issues):
```powershell
# job.json
{ "id": "job2", "command": "echo Hello2" }

# enqueue
queuectl enqueue job.json
```

6. Check status and list jobs

```powershell
queuectl status
queuectl list
```

7. DLQ operations

```powershell
queuectl dlq list
queuectl dlq retry <jobId>
```

8. Change configuration (retry/backoff)

```powershell
queuectl config set --retryBase 2 --defaultMaxRetries 3
```
## Job Lifecycle

| State | Description |
|---|---|
| pending | Waiting to be picked up by a worker |
| processing | Currently being executed |
| completed | Successfully executed |
| failed | Failed, but retryable |
| dead | Permanently failed (moved to DLQ) |

## CLI Commands

| Category | Command Example | Description |
|---|---|---|
| Enqueue | `queuectl enqueue '{"id":"job1","command":"sleep 2"}'` | Add a new job to the queue |
| Workers | `queuectl worker start --count 3` | Start one or more workers (foreground) |
|  | `queuectl worker start --count 2 --detach` | Start worker(s) detached (background) and write PID to `worker.pid` |
|  | `queuectl worker stop` | Stop detached worker (reads `worker.pid`) |
| Status | `queuectl status` | Show summary of job states |
| List Jobs | `queuectl list --state pending` | List jobs by state |
| DLQ | `queuectls dlq list` / `queuectl dlq retry <jobId>` | View or retry DLQ jobs |
| Config | `queuectl config set --retryBase 2 --defaultMaxRetries 3` | Manage configuration (retry, backoff) |

## API Endpoints

| Method | Endpoint | Body / Query | Description |
|---|---|---|---|
| POST | `/enqueue` | `{ command, id?, max_retries? }` | Add job to queue |
| GET | `/list?state=pending` | - | List jobs by state |
| GET | `/status` | - | Job statistics |
| GET | `/dlq` | - | List Dead Letter Queue jobs |
| POST | `/dlq/retry/:id` | - | Retry job from DLQ |
| POST | `/config` | `{ retryBase, defaultMaxRetries }` | Update retry/backoff config |

## Frontend Dashboard

Built with React + Vite + Tailwind CSS. The frontend is optional and provides an interactive dashboard with:

- Enqueue job
- View jobs by state
- View DLQ jobs
- Retry DLQ jobs
- Auto-refresh on enqueue/retry

Create a `.env` inside the `frontend` folder (Vite uses `VITE_` prefixed variables):

```text
VITE_API_URL=http://localhost:3000
```

## Configuration

- Exponential backoff: `delay = retryBase ^ attempts` seconds
- Max retries: configurable per job (`max_retries`) or via global default
- Persistence: MongoDB (configured via `.env` `MONGODB_URI` or default `mongodb://localhost:27017/queuectl`)

## Testing

There is a PowerShell test flow at `scripts/test_flow.sh` that enqueues a success and a failing job, starts a background worker, waits for retries, then prints status and DLQ contents.

Run (ensure server is running first):

```powershell
.\scripts\test_flow.sh
```

## Architecture Overview

- **Backend**: Node.js + Express + MongoDB + Mongoose (persistent jobs)
- **Worker**: Atomically claims jobs using `findOneAndUpdate`, executes the `command`, and uses exponential backoff for retries
- **DLQ**: Jobs exceeding `max_retries` move to `dead` state and are listed under DLQ
- **Frontend**: React + Vite + Tailwind CSS dashboard for interactive control
*** End Patch