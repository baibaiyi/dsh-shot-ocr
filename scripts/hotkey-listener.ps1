# dsh-shot-ocr — global hotkey listener
#
# Stays resident, owns one system-wide hotkey, and on each press:
#   1. captures the desktop and recognises its text (capture-ocr.ps1),
#   2. writes the JSON result into <OutDir>\inbox for the Harness plugin,
#   3. brings the Harness window to the front so the text is visible.
#
# The plugin host watches the inbox and hands the text to the chat draft.
# Written for Windows PowerShell 5.1 (WinRT OCR).

param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$CaptureScript,
  [string]$Hotkey = 'Ctrl+Alt+S',
  [ValidateSet('region', 'fullscreen', 'window', 'cursor')][string]$Mode = 'region',
  [int]$Scale = 2,
  [string]$Lang = '',
  [switch]$SkipOcr,
  [string]$AppTitle = 'DeepSeek Harness',
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$inbox = Join-Path $OutDir 'inbox'
New-Item -ItemType Directory -Force -Path $inbox | Out-Null

function Write-Status($obj) {
  $json = $obj | ConvertTo-Json -Depth 5 -Compress
  [System.IO.File]::WriteAllText((Join-Path $OutDir 'listener.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
}

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DshHotkey {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MSG {
    public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt;
  }
  [DllImport("user32.dll", SetLastError = true)] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint min, uint max);
  [DllImport("user32.dll")] public static extern bool TranslateMessage(ref MSG lpMsg);
  [DllImport("user32.dll")] public static extern IntPtr DispatchMessage(ref MSG lpMsg);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int maxCount);
  public static IntPtr FindWindowByTitleSuffix(string suffix) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(hWnd, sb, sb.Capacity);
      if (sb.Length > 0 && sb.ToString().EndsWith(suffix, StringComparison.Ordinal)) { found = hWnd; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@ | Out-Null

function Convert-Hotkey([string]$text) {
  $mods = 0
  $key = ''
  foreach ($raw in ($text -split '\+')) {
    $part = $raw.Trim()
    if ($part -eq '') { continue }
    switch -Regex ($part) {
      '^(ctrl|control)$' { $mods = $mods -bor 0x2; continue }
      '^(alt)$' { $mods = $mods -bor 0x1; continue }
      '^shift$' { $mods = $mods -bor 0x4; continue }
      '^(win|super|meta)$' { $mods = $mods -bor 0x8; continue }
      default { $key = $part }
    }
  }
  if ($key -eq '') { throw "hotkey '$text' names no key" }
  $vk = 0
  if ($key -match '^[A-Za-z]$') { $vk = [int][char]$key.ToUpperInvariant() }
  elseif ($key -match '^[0-9]$') { $vk = 0x30 + [int]$key }
  elseif ($key -match '^F([1-9]|1[0-9]|2[0-4])$') { $vk = 0x70 + ([int]$Matches[1] - 1) }
  elseif ($key -eq 'PrintScreen') { $vk = 0x2C }
  else { throw "unsupported hotkey key '$key' (use A-Z, 0-9, F1-F24 or PrintScreen)" }
  return @{ mods = $mods; vk = $vk }
}

$binding = Convert-Hotkey $Hotkey
$registered = [DshHotkey]::RegisterHotKey([IntPtr]::Zero, 1, [uint32]$binding.mods, [uint32]$binding.vk)
if (-not $registered) {
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Status @{ hotkey = $Hotkey; registered = $false; error = "RegisterHotKey failed (Win32 $err); the combination is probably taken by another program" }
  Write-Output "HOTKEY-FAILED $Hotkey win32=$err"
  exit 4
}
Write-Status @{ hotkey = $Hotkey; registered = $true; pid = $PID; mode = $Mode; scale = $Scale }
Write-Output "HOTKEY-READY $Hotkey"

function Invoke-Capture {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $id = [guid]::NewGuid().ToString('n')
  $png = Join-Path $OutDir "shot-$stamp.png"
  $json = Join-Path $inbox "result-$stamp-$id.json"
  $skip = @()
  if ($SkipOcr) { $skip = @('-SkipOcr') }
  $langArgs = @()
  if (-not [string]::IsNullOrWhiteSpace($Lang)) { $langArgs = @('-Lang', $Lang) }
  try {
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $CaptureScript `
      -OutFile $png -ResultFile $json -Mode $Mode -Scale $Scale @langArgs @skip -WindowStyle Hidden | Out-Null
  } catch {
    # Leave a failed result so the UI can explain instead of waiting forever.
    $err = @{ ok = $false; error = @{ code = 'helper-failed'; message = "$($_.Exception.Message)" } } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($json, $err, (New-Object System.Text.UTF8Encoding($false)))
  }
  # Image passthrough keeps the PNG for the Host; text results discard it.
  $keepImage = $false
  try {
    $parsed = Get-Content $json -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($parsed.imagePath) { $keepImage = $true }
  } catch { }
  if (-not $keepImage) { Remove-Item -Force -ErrorAction SilentlyContinue $png }
  $hwnd = [DshHotkey]::FindWindowByTitleSuffix($AppTitle)
  if ($hwnd -ne [IntPtr]::Zero) {
    [void][DshHotkey]::ShowWindow($hwnd, 9)  # SW_RESTORE
    [void][DshHotkey]::SetForegroundWindow($hwnd)
  }
}

$msg = New-Object -TypeName 'DshHotkey+MSG'
if ($SelfTest) {
  Invoke-Capture
  exit 0
}
while ($true) {
  $r = [DshHotkey]::GetMessage([ref]$msg, [IntPtr]::Zero, 0, 0)
  if ($r -le 0) { break }
  if ($msg.message -eq 0x0312) { Invoke-Capture }
  [void][DshHotkey]::TranslateMessage([ref]$msg)
  [void][DshHotkey]::DispatchMessage([ref]$msg)
}
[void][DshHotkey]::UnregisterHotKey([IntPtr]::Zero, 1)
