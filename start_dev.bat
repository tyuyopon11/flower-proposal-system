@echo off

REM === プロジェクトフォルダへ移動 ===
cd /d C:\Users\DSPN005\Desktop\flower-proposal-app

REM === Node起動確認 ===
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js が見つかりません
  pause
  exit /b
)

REM === 開発サーバー起動 ===
start cmd /k "npm run dev"

REM === サーバー起動待ち（少し長めに） ===
timeout /t 6 >nul

REM === 管理画面 + 発注フォーム 両方開く ===
start http://localhost:3000/admin
start http://localhost:3000/order

exit