#!/usr/bin/env bash
set -e

API_PORT=3000
API="http://localhost:$API_PORT"

# 1) enqueue a quick success job
curl -s -X POST -H "Content-Type: application/json" $API/enqueue -d '{"id":"j-success","command":"echo hi"}' | jq

# 2) enqueue a failing command that will retry and move to DLQ
curl -s -X POST -H "Content-Type: application/json" $API/enqueue -d '{"id":"j-fail","command":"/bin/false","max_retries":2}' | jq

# 3) show status
curl -s $API/status | jq

# (Run worker in another terminal: node worker.js --count 2) then monitor:
for i in {1..20}; do
  echo "poll $i"
  curl -s $API/list?state=dead | jq
  curl -s $API/list?state=completed | jq
  sleep 2
done
