Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinUtil {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern IntPtr OpenDesktop(string lpszDesktop, int dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@

$hDesk = [WinUtil]::OpenDesktop("Default", 0, $false, 0x01FF)
if ($hDesk -ne [IntPtr]::Zero) {
    [void][WinUtil]::EnumDesktopWindows($hDesk, [WinUtil+EnumWindowsProc]{
        param($hWnd, $lParam)
        if ([WinUtil]::IsWindowVisible($hWnd)) {
            $sb = New-Object System.Text.StringBuilder 256
            [void][WinUtil]::GetWindowText($hWnd, $sb, 256)
            $str = $sb.ToString()
            $p = 0
            [void][WinUtil]::GetWindowThreadProcessId($hWnd, [ref]$p)
            if (-not [string]::IsNullOrWhiteSpace($str)) {
                [Console]::WriteLine("[VISIBLE on Winsta0\Default] PID: " + $p + " | Title: " + $str)
            }
        }
        return $true
    }, [IntPtr]::Zero)
    [void][WinUtil]::CloseDesktop($hDesk)
} else {
    Write-Output "Failed to open Winsta0\Default"
}
