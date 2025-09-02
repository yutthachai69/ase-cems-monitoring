$ErrorActionPreference = 'Stop'

$base  = 'http://127.0.0.1:8086'
$token = 'cems-admin-token-123456'
$headers = @{ Authorization = "Token $token"; 'Content-Type' = 'application/json' }

# Get org ID
$orgResp = Invoke-RestMethod -Headers $headers "$base/api/v2/orgs?org=CEMS"
$org     = $orgResp.orgs | Select-Object -First 1
if (-not $org) { throw 'Org CEMS not found' }
$orgID = $org.id
Write-Output "OrgID: $orgID"

# Ensure cems_1m bucket exists (retention 365 days)
$bResp   = Invoke-RestMethod -Headers $headers "$base/api/v2/buckets?orgID=$orgID"
$exists  = $bResp.buckets | Where-Object { $_.name -eq 'cems_1m' }
if (-not $exists) {
  $body = @{ orgID=$orgID; name='cems_1m'; retentionRules=@(@{ type='expire'; everySeconds=31536000 }) } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Headers $headers -Method POST -Body $body "$base/api/v2/buckets" | Out-Null
  Write-Output 'Created bucket cems_1m'
} else {
  Write-Output 'Bucket exists: cems_1m'
}

# Ensure downsampling task exists
$tResp = Invoke-RestMethod -Headers $headers "$base/api/v2/tasks?orgID=$orgID"
$task  = $tResp.tasks | Where-Object { $_.name -eq 'downsample_cems_data_to_1m' }
if (-not $task) {
  $flux = @"
option task = {name: "downsample_cems_data_to_1m", every: 1m}
from(bucket: "cems_data")
  |> range(start: -task.every)
  |> filter(fn: (r) => r._measurement == "sensor_data")
  |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
  |> to(bucket: "cems_1m", org: "CEMS")
"@
  $body = @{ orgID=$orgID; flux=$flux; status='active'; description='Downsample sensor_data to 1m means' } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Headers $headers -Method POST -Body $body "$base/api/v2/tasks" | Out-Null
  Write-Output 'Created task downsample_cems_data_to_1m'
} else {
  Write-Output 'Task exists: downsample_cems_data_to_1m'
}

Write-Output 'OK'


