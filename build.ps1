# Stop on first error
$ErrorActionPreference = "Stop"

Write-Host "Building admin site..."
cd spires-admin-fresh
npm install
npm run build
cd ..

Write-Host "Building customer app..."
cd customer-app
npm install
npm run build
cd ..

Write-Host "Build process completed successfully!"
