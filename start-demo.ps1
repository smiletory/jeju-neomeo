$ErrorActionPreference = "Stop"
$demoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$uvCommand = Get-Command uv -ErrorAction Stop

$server = Start-Process -FilePath $uvCommand.Source `
    -ArgumentList @("run", "uvicorn", "app.local_game_server:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory $demoRoot `
    -WindowStyle Hidden `
    -PassThru

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 1
        if ($health.status -eq "ok") {
            Start-Process "http://127.0.0.1:8000"
            Write-Host "제주너머 데모가 실행되었습니다. Server PID: $($server.Id)"
            exit 0
        }
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

throw "데모 서버가 제한 시간 안에 시작되지 않았습니다."
