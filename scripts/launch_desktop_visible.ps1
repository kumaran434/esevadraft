# Launch eSevaDraft Desktop visibly on Winsta0\Default
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class DesktopLauncher {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public Int32 cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public Int32 dwX;
        public Int32 dwY;
        public Int32 dwXSize;
        public Int32 dwYSize;
        public Int32 dwXCountChars;
        public Int32 dwYCountChars;
        public Int32 dwFillAttribute;
        public Int32 dwFlags;
        public Int16 wShowWindow;
        public Int16 cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public Int32 dwProcessId;
        public Int32 dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcessW(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    public static int Launch(string appPath) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"Winsta0\Default";
        si.dwFlags = 1;
        si.wShowWindow = 1;

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        StringBuilder cmd = new StringBuilder("\"" + appPath + "\"");
        bool ok = CreateProcessW(null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi);
        if (ok) return pi.dwProcessId;
        return -Marshal.GetLastWin32Error();
    }
}
"@

Write-Output "🛑 Stopping existing eSevaDraft Desktop processes..."
Get-Process -Name 'eSevaDraft Desktop' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$exePath = "C:\Users\ADMIN\AppData\Local\Programs\eSevaDraft Desktop\eSevaDraft Desktop.exe"
Write-Output "🚀 Spawning fresh eSevaDraft Desktop on Winsta0\Default..."
$pidNum = [DesktopLauncher]::Launch($exePath)
Write-Output "✅ Spawned PID: $pidNum"

Start-Sleep -Seconds 3
$procs = Get-Process -Name 'eSevaDraft Desktop' -ErrorAction SilentlyContinue
if ($procs) {
    Write-Output "✅ eSevaDraft Desktop running with PIDs: $($procs.Id -join ', ')"
    while (Get-Process -Name 'eSevaDraft Desktop' -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 2
    }
} else {
    Write-Output "⚠️ No eSevaDraft Desktop process found after spawn."
}
