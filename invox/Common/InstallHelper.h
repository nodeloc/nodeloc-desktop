#pragma once
#include <windows.h>
#include <string>
#include <TlHelp32.h>

// 安装辅助函数
class CInstallHelper
{
public:
    // 错误代码
    enum InstallErrorCode {
        INSTALL_ERR_SUCCESS = 0,
        INSTALL_ERR_INSUFFICIENT_PRIVILEGE,
        INSTALL_ERR_PATH_TOO_LONG,
        INSTALL_ERR_INVALID_PATH,
        INSTALL_ERR_PATH_EXISTS,
        INSTALL_ERR_PROCESS_RUNNING
    };
    
    // 安装前检查
    static InstallErrorCode PreInstallCheck(const std::wstring& installPath);

    static std::wstring GetDrivePath(const std::wstring& installPath);
    
    // 检查磁盘空间是否足够
    // drivePath: 驱动器路径，如 "C:\"
    // requiredSize: 需要的空间大小（字节）
    // marginSize: 额外的余量空间（字节），默认 1MB
    // 返回: 成功返回 true，失败返回 false
    static bool CheckDiskSpace(const std::wstring& drivePath, UINT64 requiredSize, UINT64 marginSize = 1ULL * 1024 * 1024);
    
    // 获取磁盘可用空间
    // drivePath: 驱动器路径，如 "C:\"
    // 返回: 可用空间大小（字节），失败返回 0
    static UINT64 GetDiskFreeSpace(const std::wstring& drivePath);
    
    // 进程检查
    static bool IsProcessRunning(const std::wstring& processName);
    static bool KillProcess(const std::wstring& processName, DWORD timeoutMs = 5000);
    
    // 创建桌面快捷方式
    static bool CreateDesktopShortcut(const std::wstring& targetPath, const std::wstring& shortcutName);
    
    // 创建开始菜单快捷方式
    static bool CreateStartMenuShortcut(const std::wstring& targetPath, const std::wstring& shortcutName, const std::wstring& folderName = L"");
    
    // 写入注册表卸载信息
    static bool WriteUninstallRegistry(const std::wstring& keys, 
        const std::wstring& appProductName,
        const std::wstring& version,
        const std::wstring& publisher,
        const std::wstring& installPath,
        const std::wstring& uninstallPath,
        const std::wstring& iconPath,
        UINT64 estimatedSize);
    
    // 删除注册表卸载信息
    static bool RemoveUninstallRegistry(const std::wstring& keys);
    
    // 删除开始菜单快捷方式
    static bool RemoveStartMenuShortcut(const std::wstring& shortcutName, const std::wstring& folderName = L"");
    
    // 删除桌面快捷方式
    static bool RemoveDesktopShortcut(const std::wstring& shortcutName);
    
    // 获取 Program Files 目录
    static std::wstring GetProgramFilesPath();

    // 获取当前用户的本地应用安装目录
    static std::wstring GetLocalProgramsPath();
    
    // 确保路径以应用名称结尾
    static std::wstring EnsureAppNameInPath(const std::wstring& path, const std::wstring& appName);
    
    // 删除目录及所有内容
    static bool RemoveDirectory(const std::wstring& path);
    
    // 获取系统语言
    static std::wstring GetSystemLanguage();
    
    // 从资源中提取二进制文件
    static bool ExtractBinaryResource(HINSTANCE hInstance, UINT resourceId, const std::wstring& outputPath);
};
