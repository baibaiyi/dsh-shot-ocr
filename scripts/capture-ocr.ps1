# dsh-shot-ocr — Windows screen capture + OCR helper
#
# Freezes the desktop into one bitmap, then:
#   region     — shows a topmost picker; drag a rectangle (Esc / right-click cancels)
#   fullscreen — the whole virtual desktop
#   window     — the foreground window
#   cursor     — the monitor under the pointer
# The chosen area is upscaled and recognised with the built-in Windows OCR
# engine (Windows.Media.Ocr).
#
# Results are written as UTF-8 JSON so the Node side never depends on the
# console code page. Exit codes: 0 ok (including a cancelled picker),
# 2 no OCR engine, 3 capture failed, 1 unexpected failure.

param(
  [string]$OutFile = "",
  [string]$ResultFile = "",
  [ValidateSet('region', 'fullscreen', 'window', 'cursor')][string]$Mode = 'region',
  [int]$Scale = 2,
  [string]$Lang = "",
  [switch]$SkipOcr,
  [switch]$HideApp,
  [string]$AppTitle = 'DeepSeek Harness'
)

$ErrorActionPreference = 'Stop'
$started = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Result($obj) {
  if ([string]::IsNullOrWhiteSpace($ResultFile)) { return }
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText($ResultFile, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Fail([string]$code, [string]$message, [int]$exitCode) {
  Write-Result @{ ok = $false; error = @{ code = $code; message = $message } }
  Write-Output "ERROR $code $message"
  exit $exitCode
}

if ([string]::IsNullOrWhiteSpace($OutFile)) { $OutFile = Join-Path $env:TEMP 'dsh-shot.png' }
if ([string]::IsNullOrWhiteSpace($ResultFile)) { $ResultFile = Join-Path $env:TEMP 'dsh-shot.json' }

try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
  [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
  [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null

  Add-Type -ReferencedAssemblies 'System.Drawing.dll', 'System.Windows.Forms.dll' -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public static class DshShotWin32 {
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder sb, int maxCount);
  [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  public static IntPtr FindWindowByTitleSuffix(string suffix) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      var sb = new System.Text.StringBuilder(512);
      GetWindowText(hWnd, sb, sb.Capacity);
      if (sb.Length > 0 && sb.ToString().EndsWith(suffix, StringComparison.Ordinal)) { found = hWnd; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}

/** Topmost frozen-screen picker: drag a rectangle, Esc or right-click cancels. */
public class DshRegionPicker : Form {
  readonly Bitmap source;
  readonly Rectangle origin;
  Point anchor;
  Rectangle selection;
  bool dragging;
  public bool Cancelled = true;
  public Rectangle Selected { get { return selection; } }

  public DshRegionPicker(Bitmap sourceBitmap, Rectangle virtualScreen) {
    source = sourceBitmap;
    origin = virtualScreen;
    Bounds = virtualScreen;
    FormBorderStyle = FormBorderStyle.None;
    StartPosition = FormStartPosition.Manual;
    TopMost = true;
    ShowInTaskbar = false;
    KeyPreview = true;
    Cursor = Cursors.Cross;
    BackColor = Color.Black;
    DoubleBuffered = true;
    SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
  }

  Rectangle Normalize(Point a, Point b) {
    return new Rectangle(Math.Min(a.X, b.X), Math.Min(a.Y, b.Y), Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
  }

  protected override void OnPaint(PaintEventArgs e) {
    Graphics g = e.Graphics;
    g.InterpolationMode = InterpolationMode.NearestNeighbor;
    g.PixelOffsetMode = PixelOffsetMode.Half;
    g.DrawImage(source, new Rectangle(0, 0, ClientSize.Width, ClientSize.Height));
    using (SolidBrush dim = new SolidBrush(Color.FromArgb(120, 0, 0, 0))) g.FillRectangle(dim, ClientRectangle);

    if (selection.Width > 1 && selection.Height > 1) {
      Region hole = new Region(selection);
      GraphicsState state = g.Save();
      g.SetClip(hole, CombineMode.Exclude);
      g.DrawImage(source, new Rectangle(0, 0, ClientSize.Width, ClientSize.Height));
      g.Restore(state);
      hole.Dispose();

      using (Pen border = new Pen(Color.FromArgb(0, 174, 255), 2f)) g.DrawRectangle(border, selection);
      string size = selection.Width + " x " + selection.Height;
      using (Font font = new Font("Microsoft YaHei UI", 10f, FontStyle.Regular, GraphicsUnit.Point))
      using (SolidBrush back = new SolidBrush(Color.FromArgb(190, 0, 0, 0)))
      using (SolidBrush text = new SolidBrush(Color.White)) {
        SizeF measured = g.MeasureString(size, font);
        float x = selection.X;
        float y = selection.Y - measured.Height - 6;
        if (y < 4) y = selection.Y + 6;
        if (x + measured.Width + 12 > ClientSize.Width) x = ClientSize.Width - measured.Width - 14;
        g.FillRectangle(back, x, y, measured.Width + 10, measured.Height + 4);
        g.DrawString(size, font, text, x + 5, y + 2);
      }
    }

    using (Font hint = new Font("Microsoft YaHei UI", 11f, FontStyle.Regular, GraphicsUnit.Point))
    using (SolidBrush back = new SolidBrush(Color.FromArgb(170, 0, 0, 0)))
    using (SolidBrush text = new SolidBrush(Color.White)) {
      string message = "拖动鼠标选择截图区域    Esc / 右键取消";
      SizeF measured = g.MeasureString(message, hint);
      float x = (ClientSize.Width - measured.Width) / 2f;
      g.FillRectangle(back, x - 12, 18, measured.Width + 24, measured.Height + 10);
      g.DrawString(message, hint, text, x, 22);
    }
  }

  protected override void OnMouseDown(MouseEventArgs e) {
    base.OnMouseDown(e);
    if (e.Button == MouseButtons.Right) { Cancelled = true; Close(); return; }
    if (e.Button != MouseButtons.Left) return;
    dragging = true;
    anchor = e.Location;
    selection = new Rectangle(e.Location, Size.Empty);
    Invalidate();
  }

  protected override void OnMouseMove(MouseEventArgs e) {
    base.OnMouseMove(e);
    if (!dragging) return;
    selection = Normalize(anchor, e.Location);
    Invalidate();
  }

  protected override void OnMouseUp(MouseEventArgs e) {
    base.OnMouseUp(e);
    if (!dragging || e.Button != MouseButtons.Left) return;
    dragging = false;
    selection = Normalize(anchor, e.Location);
    if (selection.Width < 8 || selection.Height < 8) {
      selection = Rectangle.Empty;
      Invalidate();
      return;
    }
    Cancelled = false;
    Close();
  }

  protected override void OnKeyDown(KeyEventArgs e) {
    base.OnKeyDown(e);
    if (e.KeyCode == Keys.Escape) { Cancelled = true; Close(); }
  }
}
"@ | Out-Null

  [void][DshShotWin32]::SetProcessDPIAware()

  # --- optionally hide the Harness window so it is not in its own shot ---
  $appWindow = [IntPtr]::Zero
  $appWasMinimised = $false
  if ($HideApp) {
    $appWindow = [DshShotWin32]::FindWindowByTitleSuffix($AppTitle)
    if ($appWindow -ne [IntPtr]::Zero) {
      [void][DshShotWin32]::ShowWindow($appWindow, 6)  # SW_MINIMIZE
      $appWasMinimised = $true
      Start-Sleep -Milliseconds 420
    }
  }

  try {
    $virtual = [System.Windows.Forms.SystemInformation]::VirtualScreen
    if ($virtual.Width -le 0 -or $virtual.Height -le 0) { throw 'empty virtual screen' }

    # Freeze the desktop once; every mode crops this same bitmap.
    $screen = New-Object System.Drawing.Bitmap($virtual.Width, $virtual.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($screen)
    $g.CopyFromScreen($virtual.Left, $virtual.Top, 0, 0, $virtual.Size)
    $g.Dispose()

    $cropRect = New-Object System.Drawing.Rectangle(0, 0, $virtual.Width, $virtual.Height)
    $pickedBy = $Mode

    if ($Mode -eq 'region') {
      [System.Windows.Forms.Application]::EnableVisualStyles()
      $picker = New-Object DshRegionPicker($screen, $virtual)
      [void]$picker.ShowDialog()
      $cancelled = $picker.Cancelled
      $rect = $picker.Selected
      $picker.Dispose()

      if ($cancelled -or $rect.Width -lt 8 -or $rect.Height -lt 8) {
        $screen.Dispose()
        Write-Result @{ ok = $false; error = @{ code = 'cancelled'; message = '截图已取消' } }
        Write-Output 'CANCELLED'
        exit 0
      }
      $cropRect = $rect
    } elseif ($Mode -eq 'window') {
      $h = [DshShotWin32]::GetForegroundWindow()
      if ($h -ne [IntPtr]::Zero) {
        $r = New-Object DshShotWin32+RECT
        if ([DshShotWin32]::GetWindowRect($h, [ref]$r)) {
          $rect = New-Object System.Drawing.Rectangle(($r.Left - $virtual.Left), ($r.Top - $virtual.Top), ($r.Right - $r.Left), ($r.Bottom - $r.Top))
          $rect.Intersect((New-Object System.Drawing.Rectangle(0, 0, $virtual.Width, $virtual.Height)))
          if ($rect.Width -gt 16 -and $rect.Height -gt 16) { $cropRect = $rect }
        }
      }
    } elseif ($Mode -eq 'cursor') {
      $screenAt = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position)
      $b = $screenAt.Bounds
      $cropRect = New-Object System.Drawing.Rectangle(($b.Left - $virtual.Left), ($b.Top - $virtual.Top), $b.Width, $b.Height)
    }

    $shot = New-Object System.Drawing.Bitmap($cropRect.Width, $cropRect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [System.Drawing.Graphics]::FromImage($shot)
    $g2.DrawImage($screen, (New-Object System.Drawing.Rectangle(0, 0, $cropRect.Width, $cropRect.Height)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g2.Dispose()
    $screen.Dispose()

    # OCR improves markedly with larger glyphs; keep inside the engine's 10000 px limit.
    $effectiveScale = [Math]::Max(1, $Scale)
    if ($SkipOcr) { $effectiveScale = 1 }
    $longest = [Math]::Max($shot.Width, $shot.Height)
    while ($effectiveScale -gt 1 -and ($longest * $effectiveScale) -gt 10000) { $effectiveScale-- }

    if ($effectiveScale -gt 1) {
      $big = New-Object System.Drawing.Bitmap(($shot.Width * $effectiveScale), ($shot.Height * $effectiveScale))
      $g3 = [System.Drawing.Graphics]::FromImage($big)
      $g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g3.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g3.DrawImage($shot, 0, 0, $big.Width, $big.Height)
      $g3.Dispose()
      $shot.Dispose()
      $shot = $big
    }

    $shot.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $capturedWidth = $shot.Width
    $capturedHeight = $shot.Height
    $shot.Dispose()
  } finally {
    if ($appWasMinimised -and $appWindow -ne [IntPtr]::Zero) {
      [void][DshShotWin32]::ShowWindow($appWindow, 9)  # SW_RESTORE
      [void][DshShotWin32]::SetForegroundWindow($appWindow)
    }
  }

  # --- image passthrough: hand the PNG path back instead of recognising text ---
  if ($SkipOcr) {
    $started.Stop()
    Write-Result @{
      ok        = $true
      imagePath = $OutFile
      width     = $capturedWidth
      height    = $capturedHeight
      mode      = $pickedBy
      scale     = $effectiveScale
      elapsedMs = [int]$started.ElapsedMilliseconds
    }
    Write-Output "OK image mode=$pickedBy size=${capturedWidth}x${capturedHeight} ms=$($started.ElapsedMilliseconds)"
    exit 0
  }

  # --- OCR ---
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  if ($null -eq $asTaskGeneric) { Fail 'no-async-bridge' 'This PowerShell cannot bridge WinRT async calls (Windows PowerShell 5.1 is required).' 2 }

  function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
  }

  $engine = $null
  if (-not [string]::IsNullOrWhiteSpace($Lang)) {
    try {
      $language = New-Object Windows.Globalization.Language($Lang)
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
    } catch { $engine = $null }
  }
  if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
  if ($null -eq $engine) {
    Fail 'no-ocr-language' 'No Windows OCR language pack is available. Add a language with OCR support in Windows Settings.' 2
  }
  $recogniser = $engine.RecognizerLanguage.LanguageTag

  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($OutFile)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in $result.Lines) { $lines.Add($line.Text) }
  # Windows OCR inserts a space between CJK glyphs; drop it so Chinese reads naturally.
  $text = [string]::Join("`n", $lines)
  $text = [regex]::Replace($text, '(?<=[\u4e00-\u9fff\u3400-\u4dbf])\s+(?=[\u4e00-\u9fff\u3400-\u4dbf])', '')

  $started.Stop()
  Write-Result @{
    ok        = $true
    text      = $text
    lang      = $recogniser
    lines     = $lines.Count
    width     = $capturedWidth
    height    = $capturedHeight
    mode      = $pickedBy
    scale     = $effectiveScale
    elapsedMs = [int]$started.ElapsedMilliseconds
  }
  Write-Output "OK mode=$pickedBy size=${capturedWidth}x${capturedHeight} lines=$($lines.Count) lang=$recogniser ms=$($started.ElapsedMilliseconds)"
  exit 0
} catch {
  Fail 'capture-failed' ($_.Exception.Message) 3
}
