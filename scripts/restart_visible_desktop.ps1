$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "C:\Users\ADMIN\AppData\Local\Programs\eSevaDraft Desktop\eSevaDraft Desktop.exe"
$pinfo.WorkingDirectory = "C:\Users\ADMIN\AppData\Local\Programs\eSevaDraft Desktop"
Write-Output "🚀 Spawning fresh eSevaDraft Desktop..."
$proc = [System.Diagnostics.Process]::Start($pinfo)
Write-Output "✅ eSevaDraft Desktop started with PID: $($proc.Id)"
$proc.WaitForExit()
