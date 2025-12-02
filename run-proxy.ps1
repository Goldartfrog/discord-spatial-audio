# SpatialVoice Proxy Server Launcher
# Run this to start the local proxy that connects Discord to the remote server

$installDir = "$env:USERPROFILE\SpatialVoice"

if (!(Test-Path "$installDir\proxy-server.js")) {
    Write-Host "ERROR: proxy-server.js not found. Did you run install.ps1?" -ForegroundColor Red
    exit 1
}

Write-Host "Starting SpatialVoice proxy server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

Set-Location $installDir
node proxy-server.js
