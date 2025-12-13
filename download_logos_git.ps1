$logos = @{
    "max.svg"         = "https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/max.svg"
    "crunchyroll.svg" = "https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/crunchyroll.svg"
    "jellyfin.svg"    = "https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/jellyfin.svg"
    "iptv.svg"        = "https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/iptv-smarters.svg" 
}

$destDir = "c:\Users\Power\Desktop\datos_migracion\public\logos"

foreach ($name in $logos.Keys) {
    try {
        $url = $logos[$name]
        $path = Join-Path $destDir $name
        Invoke-WebRequest -Uri $url -OutFile $path -UserAgent "Mozilla/5.0"
        Write-Host "Downloaded $name from GitHub"
    }
    catch {
        Write-Host "Failed to download $name : $_"
    }
}
