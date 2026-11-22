$current = $PID
$names = @('python.exe','pythonw.exe','node.exe','mysqld.exe','mariadbd.exe','cmd.exe')
Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $current -and $names -contains $_.Name -and $_.CommandLine -ne $null -and
  $_.CommandLine -like '*xianyu-auto-reply*'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 3
Write-Output 'services stopped'