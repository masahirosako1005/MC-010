param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$lines = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'voice-demo-lines.json') -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$speech = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$voice = $speech.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'ja-JP' } | Select-Object -First 1
if (-not $voice) { throw 'Japanese speech voice is not installed.' }
$speech.SelectVoice($voice.VoiceInfo.Name)
try {
  foreach ($line in $lines.PSObject.Properties) {
    $speech.SetOutputToWaveFile((Join-Path $OutputDirectory ($line.Name + '.wav')))
    $speech.Speak([string]$line.Value)
    $speech.SetOutputToNull()
  }
} finally { $speech.Dispose() }
