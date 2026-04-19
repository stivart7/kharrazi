# ============================================
# Kharrazi — Push to GitHub
# ============================================
Set-Location "C:\Users\HP\Desktop\gestion app location"

Write-Host "Initialisation du repo git..." -ForegroundColor Cyan
git init
git checkout -b main

Write-Host "Configuration git..." -ForegroundColor Cyan
git config user.email "1onelove040@gmail.com"
git config user.name "stivart7"

Write-Host "Ajout des fichiers (hors node_modules)..." -ForegroundColor Cyan
git add .

Write-Host "Commit initial..." -ForegroundColor Cyan
git commit -m "feat: initial commit - Kharrazi SaaS platform"

Write-Host "Configuration du remote GitHub..." -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin https://github.com/stivart7/kharrazi.git

Write-Host "Push vers GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "Done! Code pushed to GitHub." -ForegroundColor Green
Read-Host "Appuie sur Entree pour fermer"
