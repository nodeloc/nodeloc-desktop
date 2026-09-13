$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$packageJson.version
$versionParts = $version.Split('.')

if ($versionParts.Count -lt 3) {
    throw "package.json version must contain major, minor, and patch components."
}

$invoxRoot = Join-Path $projectRoot 'invox'
$releaseRoot = Join-Path $projectRoot (Join-Path 'release' $version)
$unpackedRoot = Join-Path $releaseRoot 'win-unpacked'
$configPath = Join-Path $invoxRoot 'Common\Config.h'
$binRoot = Join-Path $invoxRoot 'bin'

if (-not (Test-Path -LiteralPath $unpackedRoot)) {
    throw "Electron output was not found at $unpackedRoot"
}

$sevenZipCandidates = @(
    $env:SEVEN_ZIP,
    'C:\Program Files\7-Zip\7z.exe',
    'C:\Program Files (x86)\7-Zip\7z.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$sevenZip = $sevenZipCandidates | Select-Object -First 1

if (-not $sevenZip) {
    throw '7-Zip was not found. Install 7-Zip or set SEVEN_ZIP to 7z.exe.'
}

$msBuildCandidates = @(
    $env:MSBUILD_EXE_PATH,
    'C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe',
    'C:\Program Files\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe',
    'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$msBuild = $msBuildCandidates | Select-Object -First 1

if (-not $msBuild) {
    throw 'Visual Studio 2022 C++ Build Tools were not found. Install the Desktop development with C++ workload and ATL for v143.'
}

function New-InvoxResourceArchive {
    param([Parameter(Mandatory)][string]$ResourceRoot)

    $archive = Join-Path $ResourceRoot 'resources.zip'
    if (Test-Path -LiteralPath $archive) {
        Remove-Item -LiteralPath $archive -Force
    }

    Push-Location $ResourceRoot
    try {
        & $sevenZip a $archive 'images' 'resources' '*.xml' -tzip | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create $archive"
        }
    }
    finally {
        Pop-Location
    }
}

$originalConfig = [System.IO.File]::ReadAllText($configPath)
$utf8Bom = [System.Text.UTF8Encoding]::new($true)

try {
    $buildConfig = $originalConfig
    $buildConfig = $buildConfig -replace '#define APP_VERSION_MAJOR\s+\d+', "#define APP_VERSION_MAJOR   $($versionParts[0])"
    $buildConfig = $buildConfig -replace '#define APP_VERSION_MINOR\s+\d+', "#define APP_VERSION_MINOR   $($versionParts[1])"
    $buildConfig = $buildConfig -replace '#define APP_VERSION_BUILD\s+\d+', "#define APP_VERSION_BUILD   $($versionParts[2])"
    [System.IO.File]::WriteAllText($configPath, $buildConfig, $utf8Bom)

    New-InvoxResourceArchive -ResourceRoot (Join-Path $invoxRoot 'Uninstaller\Res')
    & $msBuild (Join-Path $invoxRoot 'InvoxSetup.sln') /t:Uninstaller /p:Configuration=Release /p:Platform=x64 /v:minimal /nologo '/clp:ErrorsOnly;Summary'
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to build the Invox uninstaller.'
    }

    New-Item -ItemType Directory -Path $binRoot -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $binRoot 'Uninstaller.exe') -Destination (Join-Path $unpackedRoot 'Uninstaller.exe') -Force

    $appArchive = Join-Path $binRoot 'app.7z'
    if (Test-Path -LiteralPath $appArchive) {
        Remove-Item -LiteralPath $appArchive -Force
    }

    Push-Location $unpackedRoot
    try {
        & $sevenZip a $appArchive '.\*' -t7z -m0=lzma2 -mx=7 -md=32m -mmt=on -ms=on | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw 'Failed to create the embedded application archive.'
        }
    }
    finally {
        Pop-Location
    }

    New-InvoxResourceArchive -ResourceRoot (Join-Path $invoxRoot 'Installer\Res')
    & $msBuild (Join-Path $invoxRoot 'InvoxSetup.sln') /t:Installer /p:Configuration=Release /p:Platform=x64 /v:minimal /nologo '/clp:ErrorsOnly;Summary'
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to build the Invox installer.'
    }

    $outputPath = Join-Path $releaseRoot "NodeLoc-Desktop-Setup-$version.exe"
    Copy-Item -LiteralPath (Join-Path $binRoot 'Installer.exe') -Destination $outputPath -Force
    Write-Host "NodeLoc installer created: $outputPath"
}
finally {
    [System.IO.File]::WriteAllText($configPath, $originalConfig, $utf8Bom)
}
