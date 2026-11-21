param([int]$Port, [int]$TimeoutSec = 120)
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  $c = New-Object Net.Sockets.TcpClient
  try {
    $r = $c.BeginConnect('127.0.0.1', $Port, $null, $null)
    if ($r.AsyncWaitHandle.WaitOne(400)) { $c.EndConnect($r); return $true }
  } catch { } finally { $c.Close() }
  Start-Sleep -Seconds 2
}
return $false