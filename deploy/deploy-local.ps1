param(
  [string]$HostName = "2.24.212.74",
  [int]$Port = 2222,
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSScriptRoot
$Ts = Get-Date -Format "yyyyMMdd-HHmmss"
$TempDir = Join-Path $env:TEMP "hidrocrm-local-deploy-$Ts"
$Archive = Join-Path $TempDir "hidrocrm-local-$Ts.tgz"
$RemoteArchive = "/tmp/hidrocrm-local-$Ts.tgz"
$RemoteScript = "/tmp/hidrocrm-local-activate-$Ts.sh"
$ActivateScript = Join-Path $PSScriptRoot "local-release-activate.sh"

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Push-Location $Repo
try {
  $Branch = (& git branch --show-current).Trim()
  $Commit = (& git rev-parse --short HEAD).Trim()
  $Status = & git status --short

  if ($Status) {
    Write-Host "ADVERTENCIA: hay cambios locales sin commit; tambien van en el paquete." -ForegroundColor Yellow
    $Status
  }

  Write-Host "==> Empaquetando carpeta local del Desktop"
  & tar.exe `
    -czf $Archive `
    --exclude=.git `
    --exclude=.next `
    --exclude=node_modules `
    --exclude=.env `
    --exclude=.env.local `
    --exclude=dev.db `
    --exclude=prisma/dev.db `
    --exclude=*.log `
    --exclude=auditoria `
    --exclude=backup `
    -C $Repo .

  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear el paquete local"
  }
}
finally {
  Pop-Location
}

Write-Host "==> Subiendo paquete al VPS"
& scp.exe -P $Port $Archive "$($User)@$($HostName):$RemoteArchive"
if ($LASTEXITCODE -ne 0) {
  throw "Fallo scp del paquete"
}

Write-Host "==> Subiendo script de activacion"
& scp.exe -P $Port $ActivateScript "$($User)@$($HostName):$RemoteScript"
if ($LASTEXITCODE -ne 0) {
  throw "Fallo scp del script"
}

Write-Host "==> Ejecutando deploy remoto"
& ssh.exe -p $Port "$($User)@$($HostName)" "bash '$RemoteScript' '$RemoteArchive' '$Branch' '$Commit'"
if ($LASTEXITCODE -ne 0) {
  throw "El deploy remoto fallo"
}

Write-Host "DEPLOY_LOCAL_OK commit=$Commit"
