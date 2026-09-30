param(
  [string]$SourceDirectory = (Join-Path $PSScriptRoot 'source'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'drafts')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$files = @(
  'base',
  'hair-01-back', 'hair-01-front', 'hair-02-front',
  'outfit-01', 'outfit-02',
  'socks-01', 'socks-02',
  'shoes-01', 'shoes-02',
  'hair-accessory-01', 'necklace-01', 'bracelet-01'
)

foreach ($name in $files) {
  $sourcePath = Join-Path $SourceDirectory "$name-source.png"
  $outputPath = Join-Path $OutputDirectory "$name.png"
  $image = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    if ($image.Width -ne 1135 -or $image.Height -ne 1386) {
      throw "Unexpected source size for ${name}: $($image.Width)x$($image.Height)"
    }
    if ($image.GetPixel(0, 0).A -ne 0) {
      throw "Transparent corner check failed for $name"
    }
  } finally { $image.Dispose() }
  Copy-Item -LiteralPath $sourcePath -Destination $outputPath
  Write-Output "$name.png 1135x1386 transparent corner"
}

# The generated short bob is a front-only concept. An empty rear file keeps
# the expected front/back naming convention for later manual refinement.
$emptyPath = Join-Path $OutputDirectory 'hair-02-back.png'
$empty = New-Object System.Drawing.Bitmap(1135, 1386, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try { $empty.Save($emptyPath, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $empty.Dispose() }
Write-Output 'hair-02-back.png 1135x1386 (empty draft)'
