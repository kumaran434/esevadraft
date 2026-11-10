$target = Get-Process -Name 'eSevaDraft Desktop' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
if (-not $target) {
    $target = Get-Process -Name 'eSevaDraft Desktop' -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($target) {
    Write-Output "Monitoring eSevaDraft PID $($target.Id)..."
    $target.WaitForExit()
} else {
    Write-Output "No eSevaDraft process found."
}
