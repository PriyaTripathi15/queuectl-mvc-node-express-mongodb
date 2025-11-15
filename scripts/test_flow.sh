#!/bin/bash
set -e

API_PORT=3000
API="http://localhost:$API_PORT"

echo "Checking if API server is reachable..."
curl -s $API/status

echo "Starting worker in background..."
node worker.js --count 1 & WORKER_PID=$!

echo "Enqueueing a successful job..."
curl -s -X POST -H "Content-Type: application/json" $API/enqueue -d '{"id":"bash-success","command":"echo success","max_retries":3}'

echo "Enqueueing a failing job (will retry and then move to DLQ)..."
curl -s -X POST -H "Content-Type: application/json" $API/enqueue -d '{"id":"bash-fail","command":"nonexistent_cmd_xyz","max_retries":2}'

echo "Waiting 20 seconds for worker to process/retry..."
sleep 20

echo "Status:"
curl -s $API/status

echo "List pending/completed:"
curl -s $API/list

echo "DLQ contents:"
curl -s $API/dlq

echo "Stopping worker (PID: $WORKER_PID)"
kill $WORKER_PID
echo "Done."

