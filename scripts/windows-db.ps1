param(
  [ValidateSet('start','stop','status')][string]$Action = 'start',
  [string]$PostgresBin = (Join-Path $PSScriptRoot '..\.tools\pgsql\bin'),
  [int]$Port = 55432
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$clusterPath = [IO.Path]::GetFullPath((Join-Path $projectRoot '.local\pgdata'))
if (-not $clusterPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Database directory must stay inside the project.' }
$pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $pgCtl)) { throw 'Set -PostgresBin to the official PostgreSQL bin directory. See README.' }
if ($Action -eq 'stop') { & $pgCtl -D $clusterPath stop -m fast; exit $LASTEXITCODE }
if ($Action -eq 'status') { & $pgCtl -D $clusterPath status; exit $LASTEXITCODE }
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.local') | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $clusterPath 'PG_VERSION'))) {
  # Single-device local demo only. Never expose to LAN. Docker uses password auth.
  & (Join-Path $PostgresBin 'initdb.exe') -D $clusterPath -U postgres -A trust --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
}
& $pgCtl -D $clusterPath status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $clusterPath -l (Join-Path $projectRoot '.local\postgres.log') -o "-h 127.0.0.1 -p $Port" start
  if ($LASTEXITCODE -ne 0) { throw 'Database startup failed.' }
}
$databaseExists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='kondo_anatato'"
if ($LASTEXITCODE -ne 0) { throw 'Database connection check failed.' }
if ($databaseExists -ne '1') {
  & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $Port -U postgres kondo_anatato
  if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
}
Write-Output "DATABASE_URL=postgres://postgres@127.0.0.1:$Port/kondo_anatato"
