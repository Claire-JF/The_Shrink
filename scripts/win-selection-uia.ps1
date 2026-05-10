# Reads the currently focused automation element's UI Automation text selection (no clipboard).
# Writes a single line: Base64(UTF-8 bytes) of the joined selection, or empty line if none.

$ErrorActionPreference = 'Stop'

try {
    Add-Type -Language CSharp @"
using System;
using System.Text;
using System.Windows.Automation;

public static class ShrinkUiaTextSelection
{
    public static string ReadSelection()
    {
        try
        {
            AutomationElement el = AutomationElement.FocusedElement;
            if (el == null) return "";

            object patternObj;
            if (!el.TryGetCurrentPattern(TextPattern.Pattern, out patternObj))
                return "";

            TextPattern tp = (TextPattern)patternObj;
            TextPatternRange[] ranges = tp.GetSelection();
            if (ranges == null || ranges.Length == 0)
                return "";

            var sb = new StringBuilder();
            foreach (TextPatternRange range in ranges)
            {
                if (range == null) continue;
                string chunk = range.GetText(-1);
                if (chunk != null) sb.Append(chunk);
            }
            return sb.ToString();
        }
        catch
        {
            return "";
        }
    }
}
"@ -ReferencedAssemblies @(
    'UIAutomationClient',
    'UIAutomationTypes',
    'WindowsBase'
)

    $raw = [ShrinkUiaTextSelection]::ReadSelection()
    if ($null -eq $raw) { $raw = "" }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
    $b64 = [Convert]::ToBase64String($bytes)
    [Console]::Out.WriteLine($b64)
    exit 0
} catch {
    [Console]::Out.WriteLine("")
    exit 0
}
