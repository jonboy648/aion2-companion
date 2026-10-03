# Offscreen smoke run: builds window + panel, saves two PNGs, exits 0.
$env:QT_QPA_PLATFORM = 'offscreen'
$shots = Join-Path $env:TEMP 'aion2c_smoke'
Set-Location (Join-Path $PSScriptRoot '..')
python -m aion2c --smoke --shot $shots
Write-Host "exit=$LASTEXITCODE"
Get-ChildItem $shots -Filter *.png | Select-Object Name, Length
exit $LASTEXITCODE
