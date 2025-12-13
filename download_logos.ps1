$logos = @{
    "netflix.svg" = "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg"
    "disney.svg" = "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg"
    "prime.svg" = "https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg"
    "max.svg" = "https://upload.wikimedia.org/wikipedia/commons/c/c9/Max_logo.svg"
    "spotify.svg" = "https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg"
    "youtube.svg" = "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg"
    "apple_tv.svg" = "https://upload.wikimedia.org/wikipedia/commons/a/ad/Apple_TV_Plus_Logo.svg"
    "crunchyroll.svg" = "https://upload.wikimedia.org/wikipedia/commons/4/47/Crunchyroll_2018_logo.svg"
    "plex.svg" = "https://upload.wikimedia.org/wikipedia/commons/7/7b/Plex_logo_2022.svg"
    "vix.svg" = "https://upload.wikimedia.org/wikipedia/commons/a/a3/Vix_logo_2022.svg"
}

$destDir = "c:\Users\Power\Desktop\datos_migracion\public\logos"
New-Item -ItemType Directory -Force -Path $destDir

foreach ($name in $logos.Keys) {
    try {
        $url = $logos[$name]
        $path = Join-Path $destDir $name
        Invoke-WebRequest -Uri $url -OutFile $path -UserAgent "Mozilla/5.0"
        Write-Host "Downloaded $name"
    } catch {
        Write-Host "Failed to download $name : $_"
    }
}
