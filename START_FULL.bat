@echo off
cd /d "%~dp0"
if not exist book.pdf (
  echo.
  echo book.pdf file not found.
  echo Copy the original PDF into this folder and rename it to book.pdf.
  echo.
  pause
  exit /b
)
start "" http://localhost:8080/index.html
py -m http.server 8080
