param([string]$DraftDirectory = (Join-Path $PSScriptRoot 'drafts'))

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class DraftPalette {
  public static void Make(string inputPath, string outputPath, bool darkSocks) {
    using (Bitmap input = new Bitmap(inputPath))
    using (Bitmap output = new Bitmap(input.Width, input.Height, PixelFormat.Format32bppArgb)) {
      Rectangle bounds = new Rectangle(0, 0, input.Width, input.Height);
      using (Graphics g = Graphics.FromImage(output)) {
        g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
        g.DrawImage(input, bounds, bounds, GraphicsUnit.Pixel);
      }
      BitmapData data = output.LockBits(bounds, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      try {
        int length = Math.Abs(data.Stride) * output.Height;
        byte[] pixels = new byte[length];
        Marshal.Copy(data.Scan0, pixels, 0, length);
        for (int y = 0; y < output.Height; y++) {
          int row = y * Math.Abs(data.Stride);
          for (int x = 0; x < output.Width; x++) {
            int i = row + x * 4;
            if (pixels[i + 3] == 0) continue;
            int blue = pixels[i], green = pixels[i + 1], red = pixels[i + 2];
            if (darkSocks) {
              int light = (red * 30 + green * 59 + blue * 11) / 100;
              if (blue > green + 12 && red < 225) {
                pixels[i] = (byte)Math.Min(255, 120 + light / 3);
                pixels[i + 1] = (byte)Math.Min(255, 45 + light / 4);
                pixels[i + 2] = (byte)Math.Min(255, 150 + light / 3);
              } else {
                pixels[i] = (byte)Math.Min(255, 25 + light / 3);
                pixels[i + 1] = (byte)Math.Min(255, 24 + light / 4);
                pixels[i + 2] = (byte)Math.Min(255, 26 + light / 3);
              }
            } else if (red > 85 && red > green * 1.35 && red > blue * 1.10) {
              int light = (red + blue) / 2;
              pixels[i] = (byte)Math.Min(255, 100 + light / 2);
              pixels[i + 1] = (byte)Math.Min(255, 85 + light / 2);
              pixels[i + 2] = (byte)Math.Min(255, 12 + light / 5);
            }
          }
        }
        Marshal.Copy(pixels, 0, data.Scan0, length);
      } finally { output.UnlockBits(data); }
      output.Save(outputPath, ImageFormat.Png);
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies 'System.Drawing'

[DraftPalette]::Make(
  (Join-Path $DraftDirectory 'socks-01.png'),
  (Join-Path $DraftDirectory 'socks-02.png'),
  $true
)
[DraftPalette]::Make(
  (Join-Path $DraftDirectory 'shoes-01.png'),
  (Join-Path $DraftDirectory 'shoes-02.png'),
  $false
)
Write-Output 'Created dark socks and teal-accent boots using the already aligned silhouettes'
