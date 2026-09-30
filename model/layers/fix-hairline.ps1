$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $PSScriptRoot 'source\hair-01-front-source.png'
$outputPath = Join-Path $PSScriptRoot 'drafts\hair-01-front.png'
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  $output = New-Object System.Drawing.Bitmap(1135, 1386, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $g = [System.Drawing.Graphics]::FromImage($output)
    try {
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 34, 77))
      try { $g.FillEllipse($brush, 470, 48, 290, 175) } finally { $brush.Dispose() }
      $g.DrawImage($source, 0, 0)
      $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $g.FillEllipse([System.Drawing.Brushes]::Transparent, 475, 175, 260, 190)
    } finally { $g.Dispose() }
    $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $output.Dispose() }
} finally { $source.Dispose() }
Write-Output 'Covered the exposed scalp above the twin-tail fringe'
