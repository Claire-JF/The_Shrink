Param(
    [Parameter(Mandatory)][string]$PayloadPath,
    [Parameter()][string]$Target = "",
    [Parameter()][string]$ProcessBaseName = ""
)

$text = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($text)) { exit 2 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ShrWin {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

function Set-ClipboardUnicode([string]$s) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText($s, [System.Windows.Forms.TextDataFormat]::UnicodeText)
}

function Resolve-Processes([string]$key) {
    $map = @{
        'cursor'   = @('Cursor')
        'codex'    = @('Codex')
        'claude'   = @('Claude')
        'vscode'   = @('Code')
        'windsurf' = @('Windsurf')
    }
    if ($map.ContainsKey($key)) {
        return $map[$key]
    }
    @()
}

function Find-MainHandle($names) {
    foreach ($n in $names) {
        try {
            $picked = @(Get-Process -Name $n -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
                    Sort-Object StartTime |
                    Select-Object -Last 1)
            if ($picked.Count -ge 1) {
                return [IntPtr]$picked[0].MainWindowHandle
            }
        } catch {}
    }
    return [IntPtr]::Zero
}

Set-ClipboardUnicode $text

$namesArray = @()
if (-not [string]::IsNullOrWhiteSpace($ProcessBaseName)) {
    $namesArray = @($ProcessBaseName.Trim())
} elseif (-not [string]::IsNullOrWhiteSpace($Target)) {
    $namesArray = Resolve-Processes ($Target.Trim().ToLowerInvariant())
}

if ($namesArray.Count -eq 0) {
    exit 10
}

$h = Find-MainHandle $namesArray
if ($h -eq [IntPtr]::Zero) {
    exit 10
}

[void][ShrWin]::ShowWindow($h, 9)
[void][ShrWin]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 175
[System.Windows.Forms.SendKeys]::SendWait("^v")

exit 0
