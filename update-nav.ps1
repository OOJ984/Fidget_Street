$files = Get-ChildItem "C:\Users\coxj5\Documents\claudecode\wicka\*.html"
$files += Get-ChildItem "C:\Users\coxj5\Documents\claudecode\wicka\admin\*.html"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $content = $content -replace 'class="fixed top-0 left-0 right-0 z-50 bg-navy-900 backdrop-blur-sm', 'class="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm" style="background-color: #051745;'
    $content = $content -replace 'class="h-10 w-auto"', 'class="h-16 lg:h-20 w-auto"'
    Set-Content $file.FullName $content
    Write-Host "Updated: $($file.Name)"
}
