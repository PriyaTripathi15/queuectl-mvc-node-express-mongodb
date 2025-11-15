#!/usr/bin/env pwsh
# Test flow for Windows PowerShell: enqueues success and failing jobs, starts a worker, then reports status and DLQ.

function Ensure-Server {
  try {
    Invoke-RestMethod -Uri "http://localhost:3000/status" -Method Get -ErrorAction Stop | Out-Null
    return $true
  } catch {
    Write-Host "API server not reachable at http://localhost:3000. Start server with: node server.js" -ForegroundColor Yellow
    return $false
  }
}

if (-not (Ensure-Server)) { exit 1 }

Write-Host "Starting worker in background..."
$workerProc = Start-Process -FilePath "node" -ArgumentList "worker.js" -PassThru
Write-Host "Worker started (PID: $($workerProc.Id))"

Write-Host "Enqueueing a successful job..."
$good = @{ id = "ps-success-$(Get-Random -Maximum 9999)"; command = "echo success"; max_retries = 3 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/enqueue" -Body $good -ContentType "application/json"

Write-Host "Enqueueing a failing job (will retry and then move to DLQ)..."
$bad = @{ id = "ps-fail-$(Get-Random -Maximum 9999)"; command = "nonexistent_cmd_xyz"; max_retries = 2 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/enqueue" -Body $bad -ContentType "application/json"

Write-Host "Waiting 20 seconds for worker to process/retry..."
Start-Sleep -Seconds 20

Write-Host "Status:"
Invoke-RestMethod -Uri "http://localhost:3000/status" -Method Get | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "List pending/completed:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:3000/list" -Method Get | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "DLQ contents:" -ForegroundColor Red
Invoke-RestMethod -Uri "http://localhost:3000/dlq" -Method Get | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "Stopping worker (PID: $($workerProc.Id))"
Stop-Process -Id $workerProc.Id -Force
Write-Host "Done."
