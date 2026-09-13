#include "StdAfx.h"
#include "UninstallerWnd.h"
#include "..\Common\Config.h"
#include "..\Common\InstallHelper.h"
#include "..\Common\Analytics.h"
#include "..\Common\MsgWnd.h"
#include "..\Common\Logger.h"
#include <shlobj.h>
#include <vector>

#define WM_UNINSTALL_PROGRESS (WM_USER + 100)
#define WM_UNINSTALL_COMPLETE (WM_USER + 101)

CUninstallerWnd::CUninstallerWnd()
    : m_pReasonOption1(NULL)
    , m_pReasonOption2(NULL)
    , m_pReasonOption3(NULL)
    , m_pFeedbackEdit(NULL)
    , m_pUninstallBtn(NULL)
    , m_pProgress(NULL)
    , m_pProgressText(NULL)
    , m_pCompleteText(NULL)
    , m_pGoodbyeBtn(NULL)
    , m_pPage1(NULL)
    , m_pPage2(NULL)
    , m_pPage3(NULL)
    , m_hUninstallThread(NULL)
    , m_bUninstalling(false)
{
    // 从注册表读取安装路径
    std::wstring regPath = std::wstring(REG_UNINSTALL_PATH) + APP_REGISTRY_KEYS;
    
    HKEY hKey = NULL;
    if (RegOpenKeyEx(HKEY_LOCAL_MACHINE, regPath.c_str(), 0, KEY_READ, &hKey) == ERROR_SUCCESS ||
        RegOpenKeyEx(HKEY_CURRENT_USER, regPath.c_str(), 0, KEY_READ, &hKey) == ERROR_SUCCESS)
    {
        WCHAR szPath[MAX_PATH] = { 0 };
        DWORD dwSize = sizeof(szPath);
        if (RegQueryValueEx(hKey, L"InstallLocation", NULL, NULL, (LPBYTE)szPath, &dwSize) == ERROR_SUCCESS)
        {
            m_strInstallPath = szPath;
        }
        RegCloseKey(hKey);
    }
    
    if (m_strInstallPath.empty())
    {
        // 使用默认路径
        m_strInstallPath = CInstallHelper::GetProgramFilesPath();
        m_strInstallPath = CInstallHelper::EnsureAppNameInPath(m_strInstallPath, APP_NAME);
    }
}

CUninstallerWnd::~CUninstallerWnd()
{
    if (m_hUninstallThread)
    {
        CloseHandle(m_hUninstallThread);
        m_hUninstallThread = NULL;
    }
}

CDuiString CUninstallerWnd::GetSkinFile()
{
    return _T("XML_UNINSTALLER");
}

LPCTSTR CUninstallerWnd::GetWindowClassName() const
{
    return APP_NAME _T("UninstallerWindow");
}

LRESULT CUninstallerWnd::OnCreate(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL& bHandled)
{
    // 在创建 UI 之前加载语言文件
    std::wstring lang = CInstallHelper::GetSystemLanguage();
    std::wstring langFile = L"resources\\lan_" + lang + L".xml";
    
    CResourceManager::GetInstance()->SetTextQueryInterface(this);
    CResourceManager::GetInstance()->LoadLanguage(langFile.c_str());
    
    // 调用基类的 OnCreate，它会创建 UI 并调用 InitWindow
    return WindowImplBase::OnCreate(uMsg, wParam, lParam, bHandled);
}

void CUninstallerWnd::InitWindow()
{
    // 获取系统 DPI
    int sysDPI =  GetDeviceCaps(m_pm.GetPaintDC(), LOGPIXELSX);
    m_pm.SetAllDPI(sysDPI);
    
    // 获取页面容器
    m_pPage1 = static_cast<CContainerUI*>(m_pm.FindControl(_T("page1")));
    m_pPage2 = static_cast<CContainerUI*>(m_pm.FindControl(_T("page2")));
    m_pPage3 = static_cast<CContainerUI*>(m_pm.FindControl(_T("page3")));
    
    // 获取第一页控件（反馈页面）
    m_pReasonOption1 = static_cast<COptionUI*>(m_pm.FindControl(_T("reason1")));
    m_pReasonOption2 = static_cast<COptionUI*>(m_pm.FindControl(_T("reason2")));
    m_pReasonOption3 = static_cast<COptionUI*>(m_pm.FindControl(_T("reason3")));
    m_pFeedbackEdit = static_cast<CRichEditUI*>(m_pm.FindControl(_T("feedback_edit")));
    m_pUninstallBtn = static_cast<CButtonUI*>(m_pm.FindControl(_T("uninstall_btn")));
    
    // 获取第二页控件（卸载进度页面）
    m_pProgress = static_cast<CProgressUI*>(m_pm.FindControl(_T("uninstall_progress")));
    m_pProgressText = static_cast<CLabelUI*>(m_pm.FindControl(_T("progress_text")));
    
    // 获取第三页控件（卸载完成页面）
    m_pCompleteText = static_cast<CLabelUI*>(m_pm.FindControl(_T("complete_text")));
    m_pGoodbyeBtn = static_cast<CButtonUI*>(m_pm.FindControl(_T("goodbye_btn")));
    
    // 初始化控件状态
    if (m_pReasonOption1)
    {
        m_pReasonOption1->Selected(true);
    }

    // 显示第一页（反馈页面）
    SwitchToPage(1);
    
    // 设置分析端点
    CAnalytics::GetInstance()->SetEndpoint(ANALYTICS_ENDPOINT);
}

LPCTSTR CUninstallerWnd::QueryControlText(LPCTSTR lpstrId, LPCTSTR lpstrType)
{
    return NULL;
}

std::wstring CUninstallerWnd::GetLocalizedText(const std::wstring& textId)
{
    CDuiString strText = CResourceManager::GetInstance()->GetText(textId.c_str());
    if (strText.IsEmpty())
    {
        // 如果找不到翻译，返回原始ID作为备用
        return textId;
    }
    return std::wstring(strText.GetData());
}

void CUninstallerWnd::Notify(TNotifyUI& msg)
{
    if (msg.sType == _T("windowinit"))
    {
        // 窗口初始化
    }
    else if (msg.sType == _T("click"))
    {
        CDuiString strName = msg.pSender->GetName();
        
        if (strName == _T("closebtn"))
        {
            if (m_bUninstalling)
            {
                if(MSGID_CANCEL == CMsgWnd::Confirm(m_hWnd, L"msgbox_confirm_exit_message"))
                {
                    return;
                }
                
                // 用户确认强制退出
                CLogger::GetInstance()->LogWarning(L"User clicked close button during uninstallation, force exit");
                CLogger::GetInstance()->LogWarning(L"Uninstallation may not be fully completed, residual files or registry entries may exist");
                
                // 如果卸载线程还在运行，等待其结束（最多等待2秒）
                if (m_hUninstallThread)
                {
                    // 设置标志让卸载线程知道需要停止
                    m_bUninstalling = false;
                    
                    // 等待线程结束
                    DWORD dwWaitResult = WaitForSingleObject(m_hUninstallThread, 2000);
                    if (dwWaitResult == WAIT_TIMEOUT)
                    {
                        CLogger::GetInstance()->LogWarning(L"Uninstall thread did not respond in time, force terminating");
                        TerminateThread(m_hUninstallThread, 0);
                    }
                    CloseHandle(m_hUninstallThread);
                    m_hUninstallThread = NULL;
                }
                
                CLogger::GetInstance()->LogInfo(L"Program will exit");
            }
            ::DestroyWindow(m_hWnd);
        }
        else if (strName == _T("minbtn"))
        {
            SendMessage(WM_SYSCOMMAND, SC_MINIMIZE, 0);
        }
        else if (strName == _T("uninstall_btn"))
        {
            m_strReason = GetSelectedReason();
            m_strFeedback = GetFeedback();
            StartUninstall();
        }
        else if (strName == _T("goodbye_btn"))
        {
            SelfDelete();
            ::DestroyWindow(m_hWnd);
        }
        else
        {
            // 通用处理：检查是否有关联控件
            HandleRelatedControlClick(msg.pSender);
        }
    }
}

LRESULT CUninstallerWnd::OnDestroy(UINT /*uMsg*/, WPARAM /*wParam*/, LPARAM /*lParam*/, BOOL &bHandled)
{
    bHandled = FALSE;
    // 退出程序
    PostQuitMessage(0);
    return 0;
}

LRESULT CUninstallerWnd::HandleMessage(UINT uMsg, WPARAM wParam, LPARAM lParam)
{
    if (uMsg == WM_UNINSTALL_PROGRESS)
    {
        int percent = (int)wParam;
        std::wstring* pText = (std::wstring*)lParam;
        
        if (m_pProgress)
        {
            m_pProgress->SetValue(percent);
        }
        
        if (m_pProgressText && pText)
        {
            m_pProgressText->SetText(pText->c_str());
            delete pText;
        }
        
        return 0;
    }
    else if (uMsg == WM_UNINSTALL_COMPLETE)
    {
        bool success = (bool)wParam;
        
        if (success)
        {
            // 切换到第三页（卸载完成页面）
            SwitchToPage(3);
        }
        else
        {
            CMsgWnd::Alert(m_hWnd, L"uninstall_failed_message");
            ::DestroyWindow(m_hWnd);
        }
        
        m_bUninstalling = false;
        return 0;
    }
    
    return WindowImplBase::HandleMessage(uMsg, wParam, lParam);
}

void CUninstallerWnd::SwitchToPage(int pageIndex)
{
    if (m_pPage1)
    {
        m_pPage1->SetVisible(pageIndex == 1);
    }
    
    if (m_pPage2)
    {
        m_pPage2->SetVisible(pageIndex == 2);
    }
    
    if (m_pPage3)
    {
        m_pPage3->SetVisible(pageIndex == 3);
    }
}

void CUninstallerWnd::StartUninstall()
{
    // 切换到卸载页面
    SwitchToPage(2);
    
    // 启动卸载线程
    m_bUninstalling = true;
    m_hUninstallThread = CreateThread(NULL, 0, UninstallThreadProc, this, 0, NULL);
}

DWORD WINAPI CUninstallerWnd::UninstallThreadProc(LPVOID lpParam)
{
    CUninstallerWnd* pThis = (CUninstallerWnd*)lpParam;
    pThis->DoUninstall();
    return 0;
}

void CUninstallerWnd::DoUninstall()
{
    bool success = false;
    
    try
    {
        // 初始化日志
        std::wstring logPath = m_strInstallPath + L"\\uninstall.log";
        CLogger::GetInstance()->SetLogFile(logPath);
        CLogger::GetInstance()->LogInfo(L"========== Uninstallation Started ==========");
        CLogger::GetInstance()->LogFormat(LOG_INFO, L"Uninstall Path: %s", m_strInstallPath.c_str());
        CLogger::GetInstance()->LogFormat(LOG_INFO, L"Uninstall Reason: %s", m_strReason.c_str());
        
        // 更新进度：开始卸载
        UpdateProgress(0, L"progress_preparing");
        Sleep(300);
        
        // 检查目标程序是否正在运行
        if (CInstallHelper::IsProcessRunning(APP_EXE_NAME))
        {
            UpdateProgress(0, L"progress_app_running");
            CLogger::GetInstance()->LogWarning(L"Target application is running, attempting to close");
            
            if (!CInstallHelper::KillProcess(APP_EXE_NAME, 5000))
            {
                UpdateProgress(0, L"progress_app_close_failed");
                CLogger::GetInstance()->LogError(L"Failed to close application");
                Sleep(3000);
                ::PostMessage(m_hWnd, WM_UNINSTALL_COMPLETE, FALSE, 0);
                return;
            }
            
            CLogger::GetInstance()->LogInfo(L"Application closed successfully");
            Sleep(300);
        }
        
        // 检查是否需要中止
        if (!m_bUninstalling)
        {
            CLogger::GetInstance()->LogWarning(L"Uninstallation aborted by user");
            ::PostMessage(m_hWnd, WM_UNINSTALL_COMPLETE, FALSE, 0);
            return;
        }
        
        // 删除桌面快捷方式
        UpdateProgress(5, L"progress_removing_shortcuts");
        if (CInstallHelper::RemoveDesktopShortcut(APP_PRODUCT_NAME))
        {
            CLogger::GetInstance()->LogInfo(L"Desktop shortcut deleted successfully");
        }
        else
        {
            CLogger::GetInstance()->LogWarning(L"Desktop shortcut does not exist or failed to delete");
        }
        Sleep(300);
        
        // 删除安装文件
        UpdateProgress(10, L"progress_removing_files");
        
        // 收集所有需要删除的文件和目录
        std::vector<std::wstring> filesToDelete;
        std::vector<std::wstring> dirsToDelete;
        CollectFilesAndDirectories(m_strInstallPath, filesToDelete, dirsToDelete);

        int totalItems = static_cast<int>(filesToDelete.size() + dirsToDelete.size());
        int processedItems = 0;
        
        // 删除文件
        for (const auto& file : filesToDelete)
        {
            SetFileAttributes(file.c_str(), FILE_ATTRIBUTE_NORMAL);
            DeleteFile(file.c_str());
            
            processedItems++;
            int progress = 30 + (processedItems * 50 / totalItems);
            UpdateProgress(progress, L"progress_removing_files");
        }
        
        // 删除目录（从最深层开始）
        for (auto it = dirsToDelete.rbegin(); it != dirsToDelete.rend(); ++it)
        {
            RemoveDirectory(it->c_str());
            
            processedItems++;
            int progress = 10 + (processedItems * 70 / totalItems);
            UpdateProgress(progress, L"progress_removing_files");
        }
        
        UpdateProgress(85, L"progress_files_removed");
        CLogger::GetInstance()->LogInfo(L"Application files deleted successfully");
        Sleep(300);
        
        // 检查是否需要中止
        if (!m_bUninstalling)
        {
            CLogger::GetInstance()->LogWarning(L"Uninstallation aborted by user (files already deleted)");
            ::PostMessage(m_hWnd, WM_UNINSTALL_COMPLETE, FALSE, 0);
            return;
        }
        
        // 删除开始菜单快捷方式
        UpdateProgress(87, L"progress_cleaning_start_menu");
        if (CInstallHelper::RemoveStartMenuShortcut(APP_PRODUCT_NAME))
        {
            CLogger::GetInstance()->LogInfo(L"Start menu shortcut deleted successfully");
        }
        else
        {
            CLogger::GetInstance()->LogWarning(L"Failed to delete start menu shortcut");
        }
        Sleep(300);
        
        // 删除注册表
        UpdateProgress(90, L"progress_cleaning_registry");
        if (CInstallHelper::RemoveUninstallRegistry(APP_REGISTRY_KEYS))
        {
            CLogger::GetInstance()->LogInfo(L"Registry cleaned up successfully");
        }
        else
        {
            CLogger::GetInstance()->LogWarning(L"Failed to clean up registry");
        }
        Sleep(300);
        
        // 上报卸载信息
        UpdateProgress(95, L"progress_cleaning_registry");
        CAnalytics::GetInstance()->ReportUninstall(m_strReason, m_strFeedback);
        
        // 卸载完成
        UpdateProgress(100, L"progress_complete");
        CLogger::GetInstance()->LogInfo(L"Uninstallation completed successfully");
        Sleep(500);
        
        success = true;
    }
    catch (...)
    {
        CLogger::GetInstance()->LogError(L"Exception occurred during uninstallation");
        success = false;
    }
    
    if (!success)
    {
        CLogger::GetInstance()->LogError(L"Uninstallation failed");
    }
    
    ::PostMessage(m_hWnd, WM_UNINSTALL_COMPLETE, success, 0);
}

void CUninstallerWnd::UpdateProgress(int percent, const std::wstring& text)
{
    std::wstring* pText = new std::wstring(text);
    ::PostMessage(m_hWnd, WM_UNINSTALL_PROGRESS, percent, (LPARAM)pText);
}

std::wstring CUninstallerWnd::GetSelectedReason()
{
    if (m_pReasonOption1 && m_pReasonOption1->IsSelected())
    {
        return L"reason1_text";
    }
    else if (m_pReasonOption2 && m_pReasonOption2->IsSelected())
    {
        return L"reason2_text";
    }
    else if (m_pReasonOption3 && m_pReasonOption3->IsSelected())
    {
        return L"reason3_text";
    }
    return L"reason_unknown";
}

std::wstring CUninstallerWnd::GetFeedback()
{
    if (m_pFeedbackEdit)
    {
        return m_pFeedbackEdit->GetText().GetData();
    }
    return L"";
}

void CUninstallerWnd::SelfDelete()
{
    // 在删除前关闭日志文件句柄
    CLogger::GetInstance()->Close();
    
    // 获取当前程序路径
    WCHAR szModulePath[MAX_PATH] = { 0 };
    GetModuleFileName(NULL, szModulePath, MAX_PATH);
    
    // 创建批处理文件来删除自身
    WCHAR szTempPath[MAX_PATH] = { 0 };
    GetTempPath(MAX_PATH, szTempPath);
    
    std::wstring batPath = szTempPath;
    batPath += L"uninstall_cleanup.bat";
    
    // 创建批处理文件
    FILE* fp = NULL;
    _wfopen_s(&fp, batPath.c_str(), L"w");
    if (fp)
    {
        fwprintf(fp, L"@echo off\n");
        fwprintf(fp, L"timeout /t 2 /nobreak > nul\n");
        fwprintf(fp, L"del /f /q \"%s\"\n", szModulePath);
        fwprintf(fp, L"rd /s /q \"%s\"\n", m_strInstallPath.c_str());
        fwprintf(fp, L"del /f /q \"%s\"\n", batPath.c_str());
        fclose(fp);
        
        // 执行批处理
        STARTUPINFO si = { 0 };
        si.cb = sizeof(si);
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE;
        
        PROCESS_INFORMATION pi = { 0 };
        
        std::wstring cmdLine = L"cmd.exe /c \"" + batPath + L"\"";
        WCHAR szCmdLine[1024] = { 0 };
        wcscpy_s(szCmdLine, cmdLine.c_str());
        
        CreateProcess(NULL, szCmdLine, NULL, NULL, FALSE, 
            CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
        
        if (pi.hProcess)
        {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }
}

void CUninstallerWnd::HandleRelatedControlClick(CControlUI* pControl)
{
    if (!pControl)
        return;

    // 获取控件的用户自定义数据（userData）
    // DuiLib 支持通过 SetUserData/GetUserData 存储自定义字符串
    CDuiString relatedControlName = pControl->GetUserData();
    
    if (relatedControlName.IsEmpty())
        return;

    // 查找关联的控件
    CControlUI* pRelatedControl = m_pm.FindControl(relatedControlName);
    if (!pRelatedControl)
        return;

    // 尝试将关联控件转换为 CheckBox
    CCheckBoxUI* pCheckBox = dynamic_cast<CCheckBoxUI*>(pRelatedControl);
    if (pCheckBox)
    {
        // 切换 CheckBox 的选中状态
        pCheckBox->Selected(!pCheckBox->IsSelected());
        
        // 触发 selectchanged 事件，让原有的业务逻辑继续工作
        m_pm.SendNotify(pCheckBox, DUI_MSGTYPE_SELECTCHANGED);
    }
    else
    {
        // 如果是 Option，也可以类似处理
        COptionUI* pOption = dynamic_cast<COptionUI*>(pRelatedControl);
        if (pOption)
        {
            pOption->Selected(!pOption->IsSelected());
            m_pm.SendNotify(pOption, DUI_MSGTYPE_SELECTCHANGED);
        }
    }
}

void CUninstallerWnd::CollectFilesAndDirectories(const std::wstring& rootPath, 
                                                   std::vector<std::wstring>& files, 
                                                   std::vector<std::wstring>& dirs)
{
    std::wstring searchPath = rootPath + L"\\*.*";
    WIN32_FIND_DATA findData;
    HANDLE hFind = FindFirstFile(searchPath.c_str(), &findData);
    
    if (hFind == INVALID_HANDLE_VALUE)
        return;
    
    do
    {
        // 跳过 . 和 ..
        if (wcscmp(findData.cFileName, L".") == 0 || 
            wcscmp(findData.cFileName, L"..") == 0)
            continue;
        
        // 跳过卸载程序自身
        if (_wcsicmp(findData.cFileName, APP_UNINSTALL_NAME) == 0)
            continue;
        
        std::wstring fullPath = rootPath + L"\\" + findData.cFileName;
        
        if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
        {
            // 递归处理子目录
            CollectFilesAndDirectories(fullPath, files, dirs);
            // 目录本身添加到列表（最后删除）
            dirs.push_back(fullPath);
        }
        else
        {
            // 文件添加到列表
            files.push_back(fullPath);
        }
    } while (FindNextFile(hFind, &findData));
    
    FindClose(hFind);
}

bool CUninstallerWnd::DoSilentUninstall()
{
    bool success = false;
    
    try
    {
        // 初始化日志
        std::wstring logPath = m_strInstallPath + L"\\uninstall_silent.log";
        CLogger::GetInstance()->SetLogFile(logPath);
        CLogger::GetInstance()->LogInfo(L"========== Silent Uninstallation Started ==========");
        CLogger::GetInstance()->LogFormat(LOG_INFO, L"Uninstall Path: %s", m_strInstallPath.c_str());
        
        // 检查目标程序是否正在运行
        if (CInstallHelper::IsProcessRunning(APP_EXE_NAME))
        {
            CLogger::GetInstance()->LogWarning(L"Target application is running, attempting to close");
            
            if (!CInstallHelper::KillProcess(APP_EXE_NAME, 5000))
            {
                CLogger::GetInstance()->LogError(L"Failed to close application");
                return false;
            }
            
            CLogger::GetInstance()->LogInfo(L"Application closed successfully");
            Sleep(1000);
        }
        
        // 删除桌面快捷方式
        if (CInstallHelper::RemoveDesktopShortcut(APP_PRODUCT_NAME))
        {
            CLogger::GetInstance()->LogInfo(L"Desktop shortcut deleted successfully");
        }
        
        // 删除安装文件
        std::vector<std::wstring> filesToDelete;
        std::vector<std::wstring> dirsToDelete;
        CollectFilesAndDirectories(m_strInstallPath, filesToDelete, dirsToDelete);
        
        // 删除文件
        for (const auto& file : filesToDelete)
        {
            SetFileAttributes(file.c_str(), FILE_ATTRIBUTE_NORMAL);
            DeleteFile(file.c_str());
        }
        
        // 删除目录（从最深层开始）
        for (auto it = dirsToDelete.rbegin(); it != dirsToDelete.rend(); ++it)
        {
            ::RemoveDirectory(it->c_str());
        }
        
        CLogger::GetInstance()->LogInfo(L"Application files deleted successfully");
        
        // 删除开始菜单快捷方式
        if (CInstallHelper::RemoveStartMenuShortcut(APP_PRODUCT_NAME))
        {
            CLogger::GetInstance()->LogInfo(L"Start menu shortcut deleted successfully");
        }
        
        // 删除注册表
        if (CInstallHelper::RemoveUninstallRegistry(APP_REGISTRY_KEYS))
        {
            CLogger::GetInstance()->LogInfo(L"Registry cleaned up successfully");
        }
        
        CLogger::GetInstance()->LogInfo(L"Silent uninstallation completed successfully");
        
        // 自删除
        SelfDelete();
        
        success = true;
    }
    catch (...)
    {
        CLogger::GetInstance()->LogError(L"Exception occurred during silent uninstallation");
        success = false;
    }
    
    return success;
}
