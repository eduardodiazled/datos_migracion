$logos = @{
    "max.svg"         = "https://upload.wikimedia.org/wikipedia/commons/c/c9/Max_%28streaming_service%29_logo.svg" 
    "crunchyroll.svg" = "https://upload.wikimedia.org/wikipedia/commons/4/47/Crunchyroll_2018_logo.svg"
    "vix.svg"         = "https://upload.wikimedia.org/wikipedia/commons/a/a9/ViX_logo.svg"
    "apple_tv.svg"    = "https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg"
}

$destDir = "c:\Users\Power\Desktop\datos_migracion\public\logos"

foreach ($name in $logos.Keys) {
    try {
        $url = $logos[$name]
        $path = Join-Path $destDir $name
        # Use Curl via PowerShell for potentially better handling or just WebRequest again
        Invoke-WebRequest -Uri $url -OutFile $path -UserAgent "Mozilla/5.0"
        Write-Host "Downloaded $name"
    }
    catch {
        Write-Host "Failed to download $name : $_"
    }
}
