Param(
    [Parameter(Mandatory)][long]$Hwnd
)

if ($Hwnd -le 0) { exit 2 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ShrWinPaste {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

Add-Type -AssemblyName System.Windows.Forms

$ptr = [IntPtr]$Hwnd
[void][ShrWinPaste]::ShowWindow($ptr, 9)
$ok = [ShrWinPaste]::SetForegroundWindow($ptr)
if (-not $ok) { exit 11 }

Start-Sleep -Milliseconds 220
[System.Windows.Forms.SendKeys]::SendWait("^v")

exit 0
