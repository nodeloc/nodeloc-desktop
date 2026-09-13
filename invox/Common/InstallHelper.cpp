#include "StdAfx.h"
#include "InstallHelper.h"
#include "Config.h"
#include <shlobj.h>
#include <shlwapi.h>
#include <atlbase.h>
#include <shobjidl.h>
#include <TlHelp32.h>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")

CInstallHelper::InstallErrorCode CInstallHelper::PreInstallCheck(const std::wstring& installPath)
{
    // 检查路径长度
    if (installPath.length() > MAX_PATH - 50) // 留一些余量给子文件
    {
        return INSTALL_ERR_PATH_TOO_LONG;
    }
    
    // 检查路径格式（必须以驱动器字母开头，如 C:\）
    if (installPath.length() < 3 || installPath[1] != L':' || installPath[2] != L'\\')
    {
        return INSTALL_ERR_INVALID_PATH;
    }
    
    // 检查驱动器字母是否合法（A-Z 或 a-z）
    wchar_t driveLetter = installPath[0];
    if (!((driveLetter >= L'A' && driveLetter <= L'Z') || (driveLetter >= L'a' && driveLetter <= L'z')))
    {
        return INSTALL_ERR_INVALID_PATH;
    }
    
    // 检查路径中是否包含非法字符（跳过驱动器部分 "C:\"）
    // Windows 文件名不允许的字符：< > : " | ? *
    // 注意：冒号只能出现在驱动器字母后（位置1），其他位置都是非法的
    const wchar_t* invalidChars = L"<>:\"|?*";
    for (size_t i = 3; i < installPath.length(); i++)  // 从第4个字符开始检查（跳过 "C:\"）
    {
        wchar_t ch = installPath[i];
        for (size_t j = 0; j < wcslen(invalidChars); j++)
        {
            if (ch == invalidChars[j])
            {
                return INSTALL_ERR_INVALID_PATH;
            }
        }
    }
    
    // 检查是否有写入权限（尝试创建临时文件）
    std::wstring testPath = installPath;
    // 确保路径存在
    SHCreateDirectoryEx(NULL, testPath.c_str(), NULL);
    
    testPath += L"\\~test_write_permission.tmp";
    HANDLE hFile = CreateFile(testPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, NULL);
    if (hFile == INVALID_HANDLE_VALUE)
    {
        DWORD dwError = GetLastError();
        if (dwError == ERROR_ACCESS_DENIED)
        {
            return INSTALL_ERR_INSUFFICIENT_PRIVILEGE;
        }
        return INSTALL_ERR_INVALID_PATH;
    }
    CloseHandle(hFile);
    DeleteFile(testPath.c_str());
    
    return INSTALL_ERR_SUCCESS;
}

bool CInstallHelper::IsProcessRunning(const std::wstring& processName)
{
    bool bFound = false;
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    
    if (hSnapshot != INVALID_HANDLE_VALUE)
    {
        PROCESSENTRY32 pe32 = { 0 };
        pe32.dwSize = sizeof(PROCESSENTRY32);
        
        if (Process32First(hSnapshot, &pe32))
        {
            do
            {
                if (_wcsicmp(pe32.szExeFile, processName.c_str()) == 0)
                {
                    bFound = true;
                    break;
                }
            } while (Process32Next(hSnapshot, &pe32));
        }
        
        CloseHandle(hSnapshot);
    }
    
    return bFound;
}

bool CInstallHelper::KillProcess(const std::wstring& processName, DWORD timeoutMs)
{
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    
    if (hSnapshot == INVALID_HANDLE_VALUE)
        return false;
    
    PROCESSENTRY32 pe32 = { 0 };
    pe32.dwSize = sizeof(PROCESSENTRY32);
    bool bKilled = false;
    
    if (Process32First(hSnapshot, &pe32))
    {
        do
        {
            if (_wcsicmp(pe32.szExeFile, processName.c_str()) == 0)
            {
                HANDLE hProcess = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, pe32.th32ProcessID);
                if (hProcess)
                {
                    // 尝试优雅关闭
                    if (TerminateProcess(hProcess, 0))
                    {
                        // 等待进程退出
                        WaitForSingleObject(hProcess, timeoutMs);
                        bKilled = true;
                    }
                    CloseHandle(hProcess);
                }
            }
        } while (Process32Next(hSnapshot, &pe32));
    }
    
    CloseHandle(hSnapshot);
    return bKilled;
}

bool CInstallHelper::CreateDesktopShortcut(const std::wstring& targetPath, const std::wstring& shortcutName)
{
    // 使用 CoInitializeEx 支持多线程，S_FALSE 表示 COM 已被初始化
    HRESULT hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    bool bNeedUninit = SUCCEEDED(hr);
    
    // 获取桌面路径
    WCHAR szDesktopPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_DESKTOP, NULL, 0, szDesktopPath);
    
    // 构建快捷方式路径
    std::wstring shortcutPath = szDesktopPath;
    shortcutPath += L"\\";
    shortcutPath += shortcutName;
    shortcutPath += L".lnk";
    
    // 创建快捷方式
    IShellLink* pShellLink = NULL;
    hr = CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLink, (void**)&pShellLink);
    
    if (SUCCEEDED(hr))
    {
        pShellLink->SetPath(targetPath.c_str());
        
        // 设置工作目录
        std::wstring workDir = targetPath;
        size_t pos = workDir.find_last_of(L"\\");
        if (pos != std::wstring::npos)
        {
            workDir = workDir.substr(0, pos);
        }
        pShellLink->SetWorkingDirectory(workDir.c_str());
        
        // 保存快捷方式
        IPersistFile* pPersistFile = NULL;
        hr = pShellLink->QueryInterface(IID_IPersistFile, (void**)&pPersistFile);
        
        if (SUCCEEDED(hr))
        {
            hr = pPersistFile->Save(shortcutPath.c_str(), TRUE);
            pPersistFile->Release();
        }
        
        pShellLink->Release();
    }
    
    // 只有我们自己初始化的 COM 才需要反初始化
    if (bNeedUninit)
    {
        CoUninitialize();
    }
    
    return SUCCEEDED(hr);
}

bool CInstallHelper::CreateStartMenuShortcut(const std::wstring& targetPath, const std::wstring& shortcutName, const std::wstring& folderName)
{
    // 使用 CoInitializeEx 支持多线程，S_FALSE 表示 COM 已被初始化
    HRESULT hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    bool bNeedUninit = SUCCEEDED(hr);
    
    // 获取开始菜单程序文件夹路径
    WCHAR szStartMenuPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_COMMON_PROGRAMS, NULL, 0, szStartMenuPath);
    
    // 如果没有管理员权限，使用当前用户的开始菜单
    if (GetLastError() == ERROR_ACCESS_DENIED)
    {
        SHGetFolderPath(NULL, CSIDL_PROGRAMS, NULL, 0, szStartMenuPath);
    }
    
    // 构建快捷方式路径
    std::wstring shortcutPath = szStartMenuPath;
    
    // 如果指定了文件夹名称，创建子文件夹
    if (!folderName.empty())
    {
        shortcutPath += L"\\";
        shortcutPath += folderName;
        
        // 检查目录是否创建成功
        if (!CreateDirectory(shortcutPath.c_str(), NULL))
        {
            DWORD dwError = GetLastError();
            // ERROR_ALREADY_EXISTS 是正常情况
            if (dwError != ERROR_ALREADY_EXISTS)
            {
                if (bNeedUninit)
                {
                    CoUninitialize();
                }
                return false;
            }
        }
    }
    
    shortcutPath += L"\\";
    shortcutPath += shortcutName;
    shortcutPath += L".lnk";
    
    // 创建快捷方式
    IShellLink* pShellLink = NULL;
    hr = CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLink, (void**)&pShellLink);
    
    if (SUCCEEDED(hr))
    {
        pShellLink->SetPath(targetPath.c_str());
        
        // 设置工作目录
        std::wstring workDir = targetPath;
        size_t pos = workDir.find_last_of(L"\\");
        if (pos != std::wstring::npos)
        {
            workDir = workDir.substr(0, pos);
        }
        pShellLink->SetWorkingDirectory(workDir.c_str());
        
        // 设置图标
        pShellLink->SetIconLocation(targetPath.c_str(), 0);
        
        // 保存快捷方式
        IPersistFile* pPersistFile = NULL;
        hr = pShellLink->QueryInterface(IID_IPersistFile, (void**)&pPersistFile);
        
        if (SUCCEEDED(hr))
        {
            hr = pPersistFile->Save(shortcutPath.c_str(), TRUE);
            pPersistFile->Release();
        }
        
        pShellLink->Release();
    }
    
    // 只有我们自己初始化的 COM 才需要反初始化
    if (bNeedUninit)
    {
        CoUninitialize();
    }
    
    return SUCCEEDED(hr);
}

bool CInstallHelper::WriteUninstallRegistry(const std::wstring& keys,
    const std::wstring& appProductName,
    const std::wstring& version,
    const std::wstring& publisher,
    const std::wstring& installPath,
    const std::wstring& uninstallPath,
    const std::wstring& iconPath,
    UINT64 estimatedSize)
{
    std::wstring regPath = std::wstring(REG_UNINSTALL_PATH) + keys;
    
    HKEY hKey = NULL;
    LONG lResult = RegCreateKeyEx(HKEY_LOCAL_MACHINE, regPath.c_str(), 0, NULL,
        REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    
    if (lResult != ERROR_SUCCESS)
    {
        // 如果无法写入 HKLM，尝试写入 HKCU
        lResult = RegCreateKeyEx(HKEY_CURRENT_USER, regPath.c_str(), 0, NULL,
            REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    }
    
    if (lResult == ERROR_SUCCESS)
    {
        // 写入显示名称
        RegSetValueEx(hKey, L"DisplayName", 0, REG_SZ, 
            (BYTE*)appProductName.c_str(), static_cast<DWORD>((appProductName.length() + 1) * sizeof(WCHAR)));
        
        // 写入版本
        RegSetValueEx(hKey, L"DisplayVersion", 0, REG_SZ,
            (BYTE*)version.c_str(), static_cast<DWORD>((version.length() + 1) * sizeof(WCHAR)));
        
        // 写入发布者
        RegSetValueEx(hKey, L"Publisher", 0, REG_SZ,
            (BYTE*)publisher.c_str(), static_cast<DWORD>((publisher.length() + 1) * sizeof(WCHAR)));
        
        // 写入安装路径
        RegSetValueEx(hKey, L"InstallLocation", 0, REG_SZ,
            (BYTE*)installPath.c_str(), static_cast<DWORD>((installPath.length() + 1) * sizeof(WCHAR)));
        
        // 写入卸载命令
        std::wstring uninstallCmd = L"\"" + uninstallPath + L"\"";
        RegSetValueEx(hKey, L"UninstallString", 0, REG_SZ,
            (BYTE*)uninstallCmd.c_str(), static_cast<DWORD>((uninstallCmd.length() + 1) * sizeof(WCHAR)));
        
        // 写入静默卸载命令
        std::wstring quietUninstallCmd = L"\"" + uninstallPath + L"\" /S";
        RegSetValueEx(hKey, L"QuietUninstallString", 0, REG_SZ,
            (BYTE*)quietUninstallCmd.c_str(), static_cast<DWORD>((quietUninstallCmd.length() + 1) * sizeof(WCHAR)));
        
        // 写入应用图标路径
        if (!iconPath.empty())
        {
            RegSetValueEx(hKey, L"DisplayIcon", 0, REG_SZ,
                (BYTE*)iconPath.c_str(), static_cast<DWORD>((iconPath.length() + 1) * sizeof(WCHAR)));
        }
        
        // 写入估计大小（KB）
        DWORD dwSize = (DWORD)(estimatedSize / 1024);
        RegSetValueEx(hKey, L"EstimatedSize", 0, REG_DWORD, (BYTE*)&dwSize, sizeof(DWORD));
        
        // 没有修改选项
        DWORD dwNoModify = 1;
        RegSetValueEx(hKey, L"NoModify", 0, REG_DWORD, (BYTE*)&dwNoModify, sizeof(DWORD));
        
        // 没有修复选项
        DWORD dwNoRepair = 1;
        RegSetValueEx(hKey, L"NoRepair", 0, REG_DWORD, (BYTE*)&dwNoRepair, sizeof(DWORD));
        
        RegCloseKey(hKey);
        return true;
    }
    
    return false;
}

bool CInstallHelper::RemoveUninstallRegistry(const std::wstring& keys)
{
    std::wstring regPath = std::wstring(REG_UNINSTALL_PATH) + keys;
    
    LONG lResult = RegDeleteKey(HKEY_LOCAL_MACHINE, regPath.c_str());
    if (lResult != ERROR_SUCCESS)
    {
        lResult = RegDeleteKey(HKEY_CURRENT_USER, regPath.c_str());
    }
    
    return lResult == ERROR_SUCCESS;
}

bool CInstallHelper::RemoveStartMenuShortcut(const std::wstring& shortcutName, const std::wstring& folderName)
{
    // 尝试从公共开始菜单删除
    WCHAR szStartMenuPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_COMMON_PROGRAMS, NULL, 0, szStartMenuPath);
    
    std::wstring shortcutPath = szStartMenuPath;
    if (!folderName.empty())
    {
        shortcutPath += L"\\";
        shortcutPath += folderName;
    }
    shortcutPath += L"\\";
    shortcutPath += shortcutName;
    shortcutPath += L".lnk";
    
    bool success = DeleteFile(shortcutPath.c_str()) != 0;
    
    // 如果文件夹为空，删除文件夹
    if (!folderName.empty())
    {
        std::wstring folderPath = szStartMenuPath;
        folderPath += L"\\";
        folderPath += folderName;
        RemoveDirectory(folderPath.c_str());
    }
    
    // 尝试从当前用户开始菜单删除
    SHGetFolderPath(NULL, CSIDL_PROGRAMS, NULL, 0, szStartMenuPath);
    
    shortcutPath = szStartMenuPath;
    if (!folderName.empty())
    {
        shortcutPath += L"\\";
        shortcutPath += folderName;
    }
    shortcutPath += L"\\";
    shortcutPath += shortcutName;
    shortcutPath += L".lnk";
    
    if (DeleteFile(shortcutPath.c_str()))
        success = true;
    
    // 如果文件夹为空，删除文件夹
    if (!folderName.empty())
    {
        std::wstring folderPath = szStartMenuPath;
        folderPath += L"\\";
        folderPath += folderName;
        ::RemoveDirectory(folderPath.c_str());
    }
    
    return success;
}

bool CInstallHelper::RemoveDesktopShortcut(const std::wstring& shortcutName)
{
    // 获取桌面路径
    WCHAR szDesktopPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_DESKTOP, NULL, 0, szDesktopPath);
    
    // 构建快捷方式路径
    std::wstring shortcutPath = szDesktopPath;
    shortcutPath += L"\\";
    shortcutPath += shortcutName;
    shortcutPath += L".lnk";
    
    // 删除快捷方式
    return DeleteFile(shortcutPath.c_str()) != 0;
}

std::wstring CInstallHelper::GetProgramFilesPath()
{
    WCHAR szPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_PROGRAM_FILES, NULL, 0, szPath);
    return szPath;
}

std::wstring CInstallHelper::GetLocalProgramsPath()
{
    WCHAR szPath[MAX_PATH] = { 0 };
    SHGetFolderPath(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, szPath);
    std::wstring result = szPath;
    result += L"\\Programs";
    return result;
}

std::wstring CInstallHelper::EnsureAppNameInPath(const std::wstring& path, const std::wstring& appName)
{
    std::wstring result = path;
    
    // 移除末尾的反斜杠
    while (!result.empty() && result[result.length() - 1] == L'\\')
    {
        result = result.substr(0, result.length() - 1);
    }
    
    // 检查路径是否已经以应用名称结尾
    size_t pos = result.find_last_of(L"\\");
    std::wstring lastName;
    if (pos != std::wstring::npos)
    {
        lastName = result.substr(pos + 1);
    }
    else
    {
        lastName = result;
    }
    
    if (_wcsicmp(lastName.c_str(), appName.c_str()) != 0)
    {
        result += L"\\";
        result += appName;
    }
    
    return result;
}

bool CInstallHelper::RemoveDirectory(const std::wstring& path)
{
    std::wstring searchPath = path + L"\\*.*";
    WIN32_FIND_DATA findData;
    HANDLE hFind = FindFirstFile(searchPath.c_str(), &findData);
    
    if (hFind == INVALID_HANDLE_VALUE)
        return false;
    
    do
    {
        if (wcscmp(findData.cFileName, L".") == 0 || wcscmp(findData.cFileName, L"..") == 0)
            continue;
        
        std::wstring fullPath = path + L"\\" + findData.cFileName;
        
        if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
        {
            RemoveDirectory(fullPath);
        }
        else
        {
            SetFileAttributes(fullPath.c_str(), FILE_ATTRIBUTE_NORMAL);
            DeleteFile(fullPath.c_str());
        }
    } while (FindNextFile(hFind, &findData));
    
    FindClose(hFind);
    
    return ::RemoveDirectory(path.c_str()) == TRUE;
}

std::wstring CInstallHelper::GetSystemLanguage()
{
    LANGID langId = GetUserDefaultUILanguage();
    WORD primaryLang = PRIMARYLANGID(langId);
    
    if (primaryLang == LANG_CHINESE)
    {
        return L"cn";
    }
    else
    {
        return L"en";
    }
}

bool CInstallHelper::ExtractBinaryResource(HINSTANCE hInstance, UINT resourceId, const std::wstring& outputPath)
{
    // 查找资源
    HRSRC hResource = ::FindResource(hInstance, MAKEINTRESOURCE(resourceId), RT_RCDATA);
    if (hResource == NULL)
    {
        return false;
    }

    // 获取资源大小
    DWORD dwSize = ::SizeofResource(hInstance, hResource);
    if (dwSize == 0)
    {
        return false;
    }
    
    // 加载资源
    HGLOBAL hGlobal = ::LoadResource(hInstance, hResource);
    if (hGlobal == NULL)
    {
        return false;
    }

    // 锁定资源
    LPVOID pData = ::LockResource(hGlobal);
    if (pData == NULL)
    {
        ::FreeResource(hGlobal);
        return false;
    }

    // 确保输出目录存在
    std::wstring dirPath = outputPath;
    size_t pos = dirPath.find_last_of(L"\\");
    if (pos != std::wstring::npos)
    {
        dirPath = dirPath.substr(0, pos);
        HRESULT hrDir = SHCreateDirectoryEx(NULL, dirPath.c_str(), NULL);
        if (FAILED(hrDir) && hrDir != HRESULT_FROM_WIN32(ERROR_ALREADY_EXISTS))
        {
            ::FreeResource(hGlobal);
            return false;
        }
    }

    // 写入文件
    HANDLE hFile = ::CreateFile(outputPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile == INVALID_HANDLE_VALUE)
    {
        ::FreeResource(hGlobal);
        return false;
    }

    DWORD dwWritten = 0;
    BOOL bWriteSuccess = ::WriteFile(hFile, pData, dwSize, &dwWritten, NULL);
    ::CloseHandle(hFile);
    ::FreeResource(hGlobal);

    return bWriteSuccess && (dwWritten == dwSize);
}

std::wstring CInstallHelper::GetDrivePath(const std::wstring& installPath)
{
    // 获取驱动器根路径
    std::wstring drivePath = installPath.substr(0, 3); // 如 "C:\"
    if (drivePath.length() < 3 || drivePath[1] != L':' || drivePath[2] != L'\\')
    {
        return NULL;
    }

    return drivePath;
}

bool CInstallHelper::CheckDiskSpace(const std::wstring& drivePath, UINT64 requiredSize, UINT64 marginSize)
{
    ULARGE_INTEGER freeBytesAvailable, totalBytes, totalFreeBytes;
    
    // 获取磁盘空间信息
    if (!GetDiskFreeSpaceEx(drivePath.c_str(), &freeBytesAvailable, &totalBytes, &totalFreeBytes))
    {
        // 获取失败，可能是无效的驱动器路径
        return false;
    }
    
    // 计算需要的总空间（包括余量）
    UINT64 neededSpace = requiredSize + marginSize;
    
    // 检查可用空间是否足够
    return freeBytesAvailable.QuadPart >= neededSpace;
}

UINT64 CInstallHelper::GetDiskFreeSpace(const std::wstring& drivePath)
{
    ULARGE_INTEGER freeBytesAvailable, totalBytes, totalFreeBytes;
    
    // 获取磁盘空间信息
    if (GetDiskFreeSpaceEx(drivePath.c_str(), &freeBytesAvailable, &totalBytes, &totalFreeBytes))
    {
        return freeBytesAvailable.QuadPart;
    }
    
    // 获取失败，返回 0
    return 0;
}
