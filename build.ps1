# Stop on first error
$ErrorActionPreference = "Stop"

Write-Host "Building main site..."
cd spires-taxis
npm install
npm run build
cd ..

Write-Host "Building admin site..."
cd spires-admin-fresh
npm install
npm run build
cd ..

Write-Host "Copying admin build to main site build folder..."
# Ensure the admin folder exists
New-Item -ItemType Directory -Force -Path "spires-taxis/build/admin" | Out-Null
# Copy admin files into /admin
Copy-Item -Path "spires-admin-fresh/build/*" -Destination "spires-taxis/build/admin" -Recurse -Force

Write-Host "Build process completed successfully!"
