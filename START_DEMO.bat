@echo off
cd /d "%~dp0"
start "" http://localhost:8080/demo.html
py -m http.server 8080
