# Runs on the server after the latest code has been pulled into $env:DEPLOY_DIR
# (called by .github/workflows/deploy.yml). Installs dependencies, builds and restarts PM2.
$ErrorActionPreference = 'Stop'
$root = $env:DEPLOY_DIR

function Run([string]$dir, [string]$cmd) {
    Write-Host ">> [$dir] $cmd"
    Push-Location (Join-Path $root $dir)
    try {
        cmd /c "$cmd 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "'$cmd' failed in '$dir' (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

# ---- Install and build ----
Run 'backend' 'npm install --no-audit --no-fund'
Run 'frontend' 'npm install --no-audit --no-fund'
Run 'frontend' 'npm run build'
# Database migrations are NOT run automatically - run 'npx knex migrate:latest' in backend\ yourself when needed

# ---- Restart the app(s) ----
if (-not $env:PM2_NAMES) { throw "Set the repository variable PM2_NAMES to the PM2 app name(s) (see 'pm2 list')" }
foreach ($name in $env:PM2_NAMES.Split(',')) {
    Run '.' "pm2 restart $($name.Trim()) --update-env"
}
Run '.' 'pm2 save'

# ---- Optional health check ----
if ($env:HEALTH_URL) {
    $ok = $false
    for ($i = 1; $i -le 10 -and -not $ok; $i++) {
        Start-Sleep -Seconds 3
        try {
            $ok = (Invoke-WebRequest -Uri $env:HEALTH_URL -UseBasicParsing -TimeoutSec 10).StatusCode -lt 400
        } catch {
            Write-Host "  waiting for $($env:HEALTH_URL) ..."
        }
    }
    if (-not $ok) { throw "App did not respond at $($env:HEALTH_URL) after restart - check 'pm2 logs'" }
    Write-Host "Health check OK: $($env:HEALTH_URL)"
}
