# SpatialVoice Installer for Windows
# Run this script in PowerShell to install SpatialVoice

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  SpatialVoice Installer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check for required tools
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow

# Check Git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed. Please install Git from https://git-scm.com/" -ForegroundColor Red
    exit 1
}
Write-Host "  Git found" -ForegroundColor Green

# Check Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js found" -ForegroundColor Green

# Check/Install pnpm
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "  pnpm not found, installing..." -ForegroundColor Yellow
    npm install -g pnpm
}
Write-Host "  pnpm found" -ForegroundColor Green

# Set install directory
$installDir = "$env:USERPROFILE\SpatialVoice"
Write-Host ""
Write-Host "[2/7] Installing to: $installDir" -ForegroundColor Yellow

# Create install directory
if (Test-Path $installDir) {
    Write-Host "  Directory exists, cleaning..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $installDir
}
New-Item -ItemType Directory -Path $installDir | Out-Null

Set-Location $installDir

# Clone Vencord
Write-Host ""
Write-Host "[3/7] Cloning Vencord..." -ForegroundColor Yellow
git clone https://github.com/Vendicated/Vencord.git
Set-Location Vencord

# Create userplugins folder and spatialVoice plugin
Write-Host ""
Write-Host "[4/7] Installing SpatialVoice plugin..." -ForegroundColor Yellow
$pluginDir = "src\userplugins\spatialVoice"
New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null

# Download the plugin from GitHub
$pluginUrl = "https://raw.githubusercontent.com/Goldartfrog/discord-spatial-audio/main/index.tsx"
Invoke-WebRequest -Uri $pluginUrl -OutFile "$pluginDir\index.tsx"
Write-Host "  Plugin installed" -ForegroundColor Green

# Install Vencord dependencies
Write-Host ""
Write-Host "[5/7] Installing Vencord dependencies (this may take a minute)..." -ForegroundColor Yellow
pnpm install

# Build Vencord
Write-Host ""
Write-Host "[6/7] Building Vencord..." -ForegroundColor Yellow
pnpm build

# Inject into Discord
Write-Host ""
Write-Host "[7/7] Injecting Vencord into Discord..." -ForegroundColor Yellow
Write-Host "  Please close Discord if it's running, then follow the prompts." -ForegroundColor Cyan
pnpm inject

# Download server files to parent directory
Write-Host ""
Write-Host "Downloading server files..." -ForegroundColor Yellow
Set-Location $installDir

# Download proxy server
$proxyUrl = "https://raw.githubusercontent.com/Goldartfrog/discord-spatial-audio/main/proxy-server.js"
Invoke-WebRequest -Uri $proxyUrl -OutFile "proxy-server.js"

# Download run script
$runUrl = "https://raw.githubusercontent.com/Goldartfrog/discord-spatial-audio/main/run-proxy.ps1"
Invoke-WebRequest -Uri $runUrl -OutFile "run-proxy.ps1"

# Install ws package for proxy
npm init -y | Out-Null
npm install ws

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start Discord and enable 'SpatialVoice' in Settings > Vencord > Plugins"
Write-Host "  2. Run the proxy server: .\run-proxy.ps1"
Write-Host "  3. Open the canvas UI and enter your Discord User ID"
Write-Host "  4. Join a voice channel and drag yourself around!"
Write-Host ""
Write-Host "Install location: $installDir" -ForegroundColor Gray
Write-Host ""
