# =====================================================================
# start.ps1 - 古文単語帳アプリをローカルサーバーで開く
# ---------------------------------------------------------------------
# 使い方（PowerShell で）:
#     cd D:\kobun_app
#     powershell -ExecutionPolicy Bypass -File .\start.ps1
#   ポートを変えたいとき:
#     powershell -ExecutionPolicy Bypass -File .\start.ps1 -Port 5600
#
# ※ このスクリプトは必須ではありません。index.html をダブルクリック
#    （file:// で開く）だけでも全機能が動きます。
#    サーバー経由にすると URL が短くなり、スマホから同一 LAN で開くのも
#    楽になります。
#
# ※ 日本語入りの .bat は cp932 の問題で壊れやすいため、あえて .ps1 に
#    しています（.bat は作りません）。
# =====================================================================
param(
    [int]$Port = 5520
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

# python / py のどちらかを探す
$python = $null
foreach ($cand in @('python', 'py')) {
    $cmd = Get-Command $cand -ErrorAction SilentlyContinue
    if ($cmd) { $python = $cmd.Source; break }
}

if (-not $python) {
    Write-Host ''
    Write-Host 'Python が見つかりませんでした。' -ForegroundColor Yellow
    Write-Host 'サーバーは使えませんが、index.html をダブルクリックすればそのまま動きます。'
    Write-Host ("  " + (Join-Path $root 'index.html'))
    Start-Process (Join-Path $root 'index.html')
    exit 0
}

$url = "http://localhost:$Port/"

Write-Host ''
Write-Host '古文単語帳アプリを起動します' -ForegroundColor Cyan
Write-Host ("  配信ディレクトリ : " + $root)
Write-Host ("  URL              : " + $url)
Write-Host '  停止するには Ctrl+C'
Write-Host ''

# ブラウザは 1.5 秒後に開く（サーバーが立ち上がるのを待つ）
Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Milliseconds 1500
    Start-Process $u
} -ArgumentList $url | Out-Null

Set-Location $root
& $python -m http.server $Port --bind 127.0.0.1
