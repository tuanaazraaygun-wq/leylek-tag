# EAS yuklemesi ECONNRESET ile duserse birkaç kez tekrar dener.
# Kullanim: cd frontend; .\scripts\eas-build-android-retry.ps1
$ErrorActionPreference = "Continue"
$max = 6
for ($i = 1; $i -le $max; $i++) {
    Write-Host "`n=== EAS build denemesi $i / $max ===" -ForegroundColor Cyan
    npx eas-cli@latest build --platform android --profile simple --non-interactive --no-wait
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nBasarili." -ForegroundColor Green
        exit 0
    }
    $wait = [Math]::Min(120, 15 * $i)
    Write-Host "Basarisiz. $wait sn sonra tekrar..." -ForegroundColor Yellow
    Start-Sleep -Seconds $wait
}
Write-Host "`nTum denemeler basarisiz. Asagidakileri deneyin:" -ForegroundColor Red
Write-Host "- Ethernet / baska Wi-Fi veya telefon hotspot" 
Write-Host "- VPN ve kurumsal proxy kapali"
Write-Host "- Antivirus gecici: HTTPS tarama / SSL inspection kapat"
Write-Host "- Yonetici CMD: netsh int ipv6 set teredo disabled"
exit 1
