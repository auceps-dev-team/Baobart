# Redémarre le serveur QA (port 3400) avec une horloge décalée.
#   powershell -File qa/serveur-a.ps1 -Jours 8 [-Heures 2]
param([int]$Jours = 0, [int]$Heures = 0)
$qa = Split-Path -Parent $PSScriptRoot
$p = (Get-NetTCPConnection -State Listen -LocalPort 3400 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($p) { Stop-Process -Id $p -Force -Confirm:$false; Start-Sleep -Seconds 2 }
$env:NODE_ENV = "production"
$env:QA_DECALAGE_JOURS = "$Jours"
$env:QA_DECALAGE_HEURES = "$Heures"
$env:NODE_OPTIONS = "--require ./qa/horloge.cjs"
$journal = "$qa\qa\serveur-j$Jours-h$Heures"
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "node_modules/next/dist/bin/next","start","-p","3400" -WorkingDirectory $qa -RedirectStandardOutput "$journal.log" -RedirectStandardError "$journal.err.log" -WindowStyle Hidden
foreach ($i in 1..30) { Start-Sleep -Seconds 2; try { $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3400/connexion" -TimeoutSec 5; if ($r.StatusCode -eq 200) { break } } catch {} }
Get-Content "$journal.log" | Select-String "horloge"
"serveur prêt (J+$Jours, H+$Heures)"
