#pragma once

// 将数字转换为字符串
#define STRINGIFY(x) #x
#define TOSTRING(x) STRINGIFY(x)

// 版本号定义
#define APP_VERSION_MAJOR   0
#define APP_VERSION_MINOR   1
#define APP_VERSION_BUILD   0
#define APP_VERSION_REVISION 0

// 应用程序配置
#define APP_NAME           L"NodeLoc"
#define APP_PRODUCT_NAME   L"NodeLoc"
#define APP_VERSION        L"" TOSTRING(APP_VERSION_MAJOR) "." TOSTRING(APP_VERSION_MINOR) "." TOSTRING(APP_VERSION_BUILD) "." TOSTRING(APP_VERSION_REVISION)
#define APP_PUBLISHER      L"NodeLoc"
#define APP_EXE_NAME       L"NodeLoc.exe"
#define APP_UNINSTALL_NAME L"Uninstaller.exe"

// 版权信息
#define APP_COPYRIGHT      L"Copyright © 2026 NodeLoc"
#define APP_DESCRIPTION    L"NodeLoc Installer & Uninstaller"

// 安装包文件
#define APP_ARCHIVE        L"app.7z"
#define APP_REGISTRY_KEYS  L"com.nodeloc.desktop"

// 注册表路径
#define REG_UNINSTALL_PATH L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"

// 隐私政策 URL
#define PRIVACY_URL       L"https://www.nodeloc.com/privacy"

// 分析上报 API
#define ANALYTICS_ENDPOINT L""
