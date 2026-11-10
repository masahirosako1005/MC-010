param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
$player = [System.Media.SoundPlayer]::new($Path)
try { $player.PlaySync() } finally { $player.Dispose() }
