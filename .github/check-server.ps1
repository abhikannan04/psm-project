# Read-only pre-check for deploys. Run on the server in PowerShell (as the user that runs PM2):
#   powershell -ExecutionPolicy Bypass -File check-server.ps1 -Path "D:\<project folder>"
# Changes nothing. Writes server-check-report.txt next to this script - send that file back.
param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = 'Continue'
$report = Join-Path $PSScriptRoot 'server-check-report.txt'
$lines = New-Object System.Collections.Generic.List[string]
function Out([string]$s) { Write-Host $s; $lines.Add($s) }
function Check([bool]$ok, [string]$msg) { if ($ok) { Out "  [OK]   $msg" } else { Out "  [FIX]  $msg" } }
function Tool([string]$name, [string]$verArgs) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $cmd) { Check $false "$name is not installed / not on PATH"; return $false }
    $v = (cmd /c "$name $verArgs 2>&1" | Select-Object -First 1)
    Check $true "$name $v ($($cmd.Source))"
    return $true
}

Out "=== Server check $(Get-Date -Format 'yyyy-MM-dd HH:mm') on $env:COMPUTERNAME as $env:USERDOMAIN\$env:USERNAME ==="

Out ""; Out "1. Tools"
$null = Tool git '--version'
$null = Tool node '--version'
$null = Tool npm '--version'
$hasPm2 = Tool pm2 '--version'

Out ""; Out "2. Internet access to GitHub"
Out "  (needed by the GitHub runner; any [FIX] here must be allowed by IT in the firewall/proxy)"
foreach ($u in 'https://github.com', 'https://api.github.com', 'https://codeload.github.com',
               'https://pipelines.actions.githubusercontent.com', 'https://broker.actions.githubusercontent.com',
               'https://results-receiver.actions.githubusercontent.com', 'https://pkg.actions.githubusercontent.com',
               'https://objects.githubusercontent.com', 'https://release-assets.githubusercontent.com') {
    try { $null = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 15 -Method Head; Check $true "reachable: $u" }
    catch { $code = $_.Exception.Response.StatusCode.value__; Check ([bool]$code) "reachable: $u $(if (-not $code) { '- BLOCKED: ' + $_.Exception.Message })" }
}

Out ""; Out "3. PM2 apps"
$apps = @()
if ($hasPm2) {
    $json = (cmd /c "pm2 jlist 2>nul") -join ''
    $m = [regex]::Match($json, '\[\s*(\{|\])')
    if ($m.Success) {
        try {
            # ConvertFrom-Json in PowerShell 5.1 rejects PM2's env (PATH and Path both present), so use the .NET parser
            Add-Type -AssemblyName System.Web.Extensions
            $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
            $ser.MaxJsonLength = [int]::MaxValue
            $apps = @($ser.DeserializeObject($json.Substring($m.Index)) | ForEach-Object {
                [pscustomobject]@{ name = [string]$_['name']; status = $_['pm2_env']['status']
                    restarts = $_['pm2_env']['restart_time']; script = [string]$_['pm2_env']['pm_exec_path'] }
            })
        } catch { Out "  could not read 'pm2 jlist': $($_.Exception.Message)" }
    }
    if (-not $apps) { Check $false "no PM2 apps visible for user $env:USERNAME - run this as the user that started the apps" }
    foreach ($a in $apps) { Out ("  - name='{0}' status={1} restarts={2} script={3}" -f $a.name, $a.status, $a.restarts, $a.script) }
}

Out ""; Out "4. Project folder"
if (-not (Test-Path $Path -PathType Container)) {
    Check $false "folder '$Path' does not exist - check the -Path value"
} else {
    $Path = (Resolve-Path $Path).Path.TrimEnd('\')
    Check (($Path -split '\\').Count -ge 2) "DEPLOY_DIR = $Path"
    $own = @($apps | Where-Object { $_.script.StartsWith("$Path\", [StringComparison]::OrdinalIgnoreCase) })
    if ($own.Count -gt 0) { Check $true "PM2_NAMES = $(($own | ForEach-Object { $_.name }) -join ',')  (status: $(($own | ForEach-Object { $_.status }) -join ','))" }
    else { Check $false "no PM2 app runs from inside $Path - check the folder or 'pm2 list'" }
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Out "  (running as admin: $isAdmin)"

    # Search the project but never descend into node_modules (fast on big projects)
    function Find-Items([string]$dir, [scriptblock]$match) {
        foreach ($i in Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue) {
            if (& $match $i) { $i }
            if ($i.PSIsContainer -and $i.Name -notin 'node_modules', '.git') { Find-Items $i.FullName $match }
        }
    }

    Out ""; Out "5. Server-only files (must exist - they are not in GitHub)"
    $envs = @(Find-Items $Path { param($i) -not $i.PSIsContainer -and $i.Name -eq '.env' })
    if (-not $envs) { Check $false "no .env file found under $Path" }
    foreach ($e in $envs) {
        $keys = (Get-Content $e.FullName | Where-Object { $_ -match '^\s*[A-Za-z_]\w*\s*=' } | ForEach-Object { ($_ -split '=')[0].Trim() }) -join ', '
        Check $true "$($e.FullName.Substring($Path.Length + 1)) exists (keys: $keys)"
    }
    foreach ($u in @(Find-Items $Path { param($i) $i.PSIsContainer -and $i.Name -eq 'uploads' })) {
        $s = Get-ChildItem $u.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum
        Check $true ("{0}: {1} files, {2:N0} MB (kept by deploy)" -f $u.FullName.Substring($Path.Length + 1), $s.Count, ($s.Sum / 1MB))
    }
    if (Test-Path (Join-Path $Path '.git')) {
        $origin = cmd /c "git -c safe.directory=* -C `"$Path`" remote get-url origin 2>nul"
        Out "  [INFO] already a git folder (origin: $(if ($origin) { $origin } else { 'none' })) - first deploy backs it up and relinks it"
    } else {
        Out "  [INFO] not a git folder yet - normal; the first deploy backs it up and converts it"
    }
    $drive = Get-PSDrive -Name $Path.Substring(0, 1) -ErrorAction SilentlyContinue
    if ($drive) { Check ($drive.Free -gt 3GB) ("free space on {0}: {1:N1} GB (backup + npm need ~2 GB)" -f $drive.Name, ($drive.Free / 1GB)) }

    Out ""; Out "6. Website responds"
    $ports = @($envs | ForEach-Object { Get-Content $_.FullName } | Where-Object { $_ -match '^\s*PORT\s*=' } | ForEach-Object { ($_ -split '=', 2)[1].Trim().Trim('"', "'") } | Where-Object { $_ })
    if (-not $ports) { Out "  [INFO] no PORT in .env - find the port in 'pm2 logs' and tell Claude" }
    foreach ($port in $ports | Select-Object -Unique) {
        try { $r = Invoke-WebRequest "http://localhost:$port" -UseBasicParsing -TimeoutSec 15; Check $true "http://localhost:$port answered $($r.StatusCode)  ->  HEALTH_URL = http://localhost:$port" }
        catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code) { Check $true "http://localhost:$port answered $code (app is up; pick a page that returns 200 for HEALTH_URL)" }
            else { Check $false "http://localhost:$port did not answer: $($_.Exception.Message)" }
        }
    }

    Out ""; Out "7. Code fingerprint (compared with GitHub to find edits made directly on the server)"
    $skipDir = '\\(node_modules|dist|build|uploads|\.git|\.github)\\'
    $files = Find-Items $Path { param($i) -not $i.PSIsContainer } | Where-Object {
        $rel = $_.FullName.Substring($Path.Length)
        $rel -notmatch $skipDir -and $_.Name -notmatch '^\.env$|\.log$|\.zip$|^server-check-report\.txt$|^check-server\.ps1$' -and $_.Length -lt 5MB
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    $utf8 = New-Object Text.UTF8Encoding($false)
    $textExt = '\.(js|jsx|cjs|mjs|json|css|html|md|sql|config|txt|svg|example|gitignore|py|csv)$'
    foreach ($f in $files) {
        if ($f.Name -match $textExt) {
            # text: ignore BOM and CRLF/LF differences
            $bytes = $utf8.GetBytes(([IO.File]::ReadAllText($f.FullName)).Replace("`r`n", "`n"))
        } else {
            $bytes = [IO.File]::ReadAllBytes($f.FullName)
        }
        $hash = -join ($sha.ComputeHash($bytes)[0..7] | ForEach-Object { $_.ToString('x2') })
        $lines.Add("  FP $hash $($f.FullName.Substring($Path.Length + 1).Replace('\', '/'))")
    }
    Out "  $(@($files).Count) source files fingerprinted (listed in the report file)"
    Out "  most recently changed on this server:"
    foreach ($f in $files | Sort-Object LastWriteTime -Descending | Select-Object -First 5) {
        Out ("    {0:yyyy-MM-dd HH:mm}  {1}" -f $f.LastWriteTime, $f.FullName.Substring($Path.Length + 1))
    }
}

$lines | Set-Content $report -Encoding utf8
Out ""; Out "Report saved to $report - send this file back."
