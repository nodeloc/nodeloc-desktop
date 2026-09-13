@echo off
setlocal enabledelayedexpansion

call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

:: 获取项目根目录
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

if not exist "bin\app.7z" (
    echo Error: Missing required file bin\app.7z
    exit /b 1
)

:: 0. 打包资源
echo [Step 0] Building Installer.exe...
if not exist "Installer\Res\resources.zip" (
    echo          Creating installer resources.zip...
    cd /d "%ROOT_DIR%Installer\Res"
    7z a resources.zip images\* resources\* installer.xml
    if errorlevel 1 (
        echo Error: Failed to create installer resources.zip
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)
if not exist "Uninstaller\Res\resources.zip" (
    echo          Creating uninstaller resources.zip...
    cd /d "%ROOT_DIR%Uninstaller\Res"
    7z a resources.zip images\* resources\* uninstaller.xml
    if errorlevel 1 (
        echo Error: Failed to create uninstaller resources.zip
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)

:: 1. 编译项目
echo [Step 1] Building Projects...
cd /d "%ROOT_DIR%"
msbuild InvoxSetup.sln /p:Configuration=Release /p:Platform=x64 /v:minimal /nologo
if errorlevel 1 (
    echo Error: Failed to build Uninstaller.exe
    exit /b 1
)

echo.
echo ==========================================
echo Build completed successfully!
echo Output: dist\Installer.exe
echo         dist\Uninstaller.exe
echo ==========================================

endlocal
