# Export F1 PNG ladder — design-lab only
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$SvgDir = Join-Path $Root "svg"
$PngDir = Join-Path $Root "png\f1"
$Resvg = "npx --yes @resvg/resvg-js-cli"

New-Item -ItemType Directory -Force -Path $PngDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PngDir "ios") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PngDir "favicon") | Out-Null

function Export-Png($inputSvg, $outputPng, $size) {
  Write-Host "Export ${size}px -> $outputPng"
  Invoke-Expression "$Resvg `"$inputSvg`" `"$outputPng`" --fit-width $size --fit-height $size"
}

$master = Join-Path $SvgDir "f1-meridian-wing-master.svg"
$micro = Join-Path $SvgDir "f1-meridian-wing-micro.svg"
$icon1024 = Join-Path $SvgDir "f1-meridian-wing-icon-1024.svg"
$qr = Join-Path $SvgDir "f1-meridian-wing-qr-hc.svg"

foreach ($size in @(512, 256, 128, 96, 64, 48, 32)) {
  Export-Png $master (Join-Path $PngDir "$size.png") $size
}
Export-Png $micro (Join-Path $PngDir "16.png") 16
Export-Png $micro (Join-Path $PngDir "24.png") 24

Export-Png $icon1024 (Join-Path $PngDir "1024.png") 1024
Copy-Item (Join-Path $PngDir "1024.png") (Join-Path $PngDir "ios\AppIcon-1024.png") -Force

$iosSizes = @(180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20)
foreach ($s in $iosSizes) {
  Export-Png $icon1024 (Join-Path $PngDir "ios\AppIcon-$s.png") $s
}

Export-Png $micro (Join-Path $PngDir "favicon\favicon-16.png") 16
Export-Png $master (Join-Path $PngDir "favicon\favicon-32.png") 32
Export-Png $master (Join-Path $PngDir "favicon\favicon-48.png") 48

Export-Png $qr (Join-Path $PngDir "qr-hc-256.png") 256

Export-Png (Join-Path $SvgDir "android-adaptive-foreground.svg") (Join-Path $PngDir "android-adaptive-foreground-1080.png") 1080
Export-Png (Join-Path $SvgDir "android-adaptive-foreground.svg") (Join-Path $PngDir "android-adaptive-foreground-432.png") 432
Export-Png (Join-Path $SvgDir "android-adaptive-background.svg") (Join-Path $PngDir "android-adaptive-background-1080.png") 1080

Write-Host "Done. PNG exports in $PngDir"
