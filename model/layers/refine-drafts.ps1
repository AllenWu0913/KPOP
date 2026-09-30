param(
  [string]$SourceDirectory = (Join-Path $PSScriptRoot 'source'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'drafts')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$maskCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class DraftAlphaMask {
  public static void Apply(string layerPath, string basePath, string outputPath) {
    using (Bitmap layer = new Bitmap(layerPath))
    using (Bitmap body = new Bitmap(basePath))
    using (Bitmap output = new Bitmap(layer.Width, layer.Height, PixelFormat.Format32bppArgb)) {
      Rectangle bounds = new Rectangle(0, 0, layer.Width, layer.Height);
      using (Graphics graphics = Graphics.FromImage(output)) {
        graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
        graphics.DrawImage(layer, bounds, bounds, GraphicsUnit.Pixel);
      }
      BitmapData bodyData = body.LockBits(bounds, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      BitmapData outData = output.LockBits(bounds, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      try {
        int bodyLength = Math.Abs(bodyData.Stride) * body.Height;
        int outLength = Math.Abs(outData.Stride) * output.Height;
        byte[] bodyBytes = new byte[bodyLength];
        byte[] outBytes = new byte[outLength];
        Marshal.Copy(bodyData.Scan0, bodyBytes, 0, bodyLength);
        Marshal.Copy(outData.Scan0, outBytes, 0, outLength);
        for (int y = 0; y < output.Height; y++) {
          int bodyRow = y * Math.Abs(bodyData.Stride);
          int outRow = y * Math.Abs(outData.Stride);
          for (int x = 0; x < output.Width; x++) {
            int bi = bodyRow + x * 4 + 3;
            int oi = outRow + x * 4 + 3;
            outBytes[oi] = (byte)((outBytes[oi] * bodyBytes[bi]) / 255);
          }
        }
        Marshal.Copy(outBytes, 0, outData.Scan0, outLength);
      } finally {
        body.UnlockBits(bodyData);
        output.UnlockBits(outData);
      }
      output.Save(outputPath, ImageFormat.Png);
    }
  }
}
'@
Add-Type -TypeDefinition $maskCode -ReferencedAssemblies 'System.Drawing'

$basePath = Join-Path $SourceDirectory 'base-source.png'
foreach ($name in @('socks-01', 'socks-02')) {
  [DraftAlphaMask]::Apply(
    (Join-Path $SourceDirectory "$name-source.png"),
    $basePath,
    (Join-Path $OutputDirectory "$name.png")
  )
  Write-Output "Masked $name to the base leg silhouette"
}

foreach ($name in @('hair-01-front', 'hair-02-front')) {
  $source = [System.Drawing.Bitmap]::FromFile((Join-Path $SourceDirectory "$name-source.png"))
  try {
    $output = New-Object System.Drawing.Bitmap(1135, 1386, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($output)
      try {
        $g.DrawImage($source, 0, 0)
        $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.FillEllipse([System.Drawing.Brushes]::Transparent, 475, 175, 260, 190)
      } finally { $g.Dispose() }
      $output.Save((Join-Path $OutputDirectory "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $output.Dispose() }
  } finally { $source.Dispose() }
  Write-Output "Cleared face opening in $name"
}

$bob = [System.Drawing.Bitmap]::FromFile((Join-Path $SourceDirectory 'hair-02-front-source.png'))
try {
  $output = New-Object System.Drawing.Bitmap(1135, 1386, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $g = [System.Drawing.Graphics]::FromImage($output)
    try {
      $g.DrawImage($bob, 0, 0)
      $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.FillEllipse([System.Drawing.Brushes]::Transparent, 455, 90, 300, 330)
    } finally { $g.Dispose() }
    $output.Save((Join-Path $OutputDirectory 'hair-02-back.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $output.Dispose() }
} finally { $bob.Dispose() }
Write-Output 'Created hair-02-back from the bob side locks'

$accessories = @(
  @{ Name='hair-accessory-01'; Crop=(New-Object System.Drawing.Rectangle(115, 285, 905, 325)); Destination=(New-Object System.Drawing.Rectangle(335, 20, 470, 170)) },
  @{ Name='necklace-01'; Crop=(New-Object System.Drawing.Rectangle(345, 545, 450, 285)); Destination=(New-Object System.Drawing.Rectangle(545, 315, 160, 102)) }
)
foreach ($spec in $accessories) {
  $source = [System.Drawing.Bitmap]::FromFile((Join-Path $SourceDirectory "$($spec.Name)-source.png"))
  try {
    $output = New-Object System.Drawing.Bitmap(1135, 1386, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($output)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($source, $spec.Destination, $spec.Crop, [System.Drawing.GraphicsUnit]::Pixel)
      } finally { $g.Dispose() }
      $output.Save((Join-Path $OutputDirectory "$($spec.Name).png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $output.Dispose() }
  } finally { $source.Dispose() }
  Write-Output "Positioned $($spec.Name)"
}
