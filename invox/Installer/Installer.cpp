#include "StdAfx.h"
#include "InstallerWnd.h"
#include "..\Common\Config.h"

void InitResource()
{
    // 资源类型
#ifdef _DEBUG
    CPaintManagerUI::SetResourceType(UILIB_FILE);
#else
    CPaintManagerUI::SetResourceType(UILIB_ZIPRESOURCE);
#endif
    // 加载资源
    switch (CPaintManagerUI::GetResourceType())
    {
    case UILIB_FILE:
    {
        CDuiString strResourcePath = CPaintManagerUI::GetInstancePath();
        strResourcePath = strResourcePath.Left(strResourcePath.GetLength() - 4);
        strResourcePath += _T("Installer\\Res\\");
        CPaintManagerUI::SetResourcePath(strResourcePath.GetData());
        CResourceManager::GetInstance()->LoadResource(_T("res.xml"), NULL);
        break;
    }
    case UILIB_RESOURCE:
    {
        CDuiString strResourcePath = CPaintManagerUI::GetInstancePath();
        strResourcePath = strResourcePath.Left(strResourcePath.GetLength() - 4);
        strResourcePath += _T("Installer\\Res\\");
        CPaintManagerUI::SetResourcePath(strResourcePath.GetData());
        CResourceManager::GetInstance()->LoadResource(_T("res.xml"), NULL);
        break;
    }
    case UILIB_ZIP:
    {
        CDuiString strResourcePath = CPaintManagerUI::GetInstancePath();
        strResourcePath = strResourcePath.Left(strResourcePath.GetLength() - 4);
        strResourcePath += _T("Installer\\Res\\");
        CPaintManagerUI::SetResourcePath(strResourcePath.GetData());
        CPaintManagerUI::SetResourceZip(_T("resources.zip"), true);
        CResourceManager::GetInstance()->LoadResource(_T("res.xml"), NULL);
        break;
    }
    case UILIB_ZIPRESOURCE:
    {
        HRSRC hResource = ::FindResource(CPaintManagerUI::GetResourceDll(), _T("IDR_ZIPRES"), _T("ZIPRES"));
        if (hResource != NULL)
        {
            DWORD dwSize = 0;
            HGLOBAL hGlobal = ::LoadResource(CPaintManagerUI::GetResourceDll(), hResource);
            if (hGlobal != NULL)
            {
                dwSize = ::SizeofResource(CPaintManagerUI::GetResourceDll(), hResource);
                if (dwSize > 0)
                {
                    CPaintManagerUI::SetResourceZip((LPBYTE)::LockResource(hGlobal), dwSize, NULL);
                    CResourceManager::GetInstance()->LoadResource(_T("res.xml"), NULL);
                }
            }
            ::FreeResource(hGlobal);
        }
    }
    break;
    }
}

int APIENTRY WinMain(HINSTANCE hInstance, HINSTANCE /*hPrevInstance*/, LPSTR /*lpCmdLine*/, int nCmdShow)
{
    bool updateMode = false;
    std::wstring installPath;
    int argumentCount = 0;
    LPWSTR* arguments = ::CommandLineToArgvW(::GetCommandLineW(), &argumentCount);
    if (arguments != NULL)
    {
        const std::wstring pathPrefix = L"--install-path=";
        for (int index = 1; index < argumentCount; ++index)
        {
            const std::wstring argument = arguments[index];
            if (argument == L"--update")
            {
                updateMode = true;
            }
            else if (argument.compare(0, pathPrefix.length(), pathPrefix) == 0)
            {
                installPath = argument.substr(pathPrefix.length());
            }
        }
        ::LocalFree(arguments);
    }
    updateMode = updateMode && !installPath.empty() && !::PathIsRelativeW(installPath.c_str());

    // 创建全局命名互斥体，防止多实例运行
    // 使用 Global\ 前缀使其在所有会话中可见
    HANDLE hMutex = ::CreateMutex(NULL, TRUE, _T("Global\\") APP_NAME _T("_DesktopSetup_SingleInstance"));
    DWORD dwError = ::GetLastError();
    
    if (dwError == ERROR_ALREADY_EXISTS)
    {
        // 已经有一个安装程序实例在运行，通过窗口类名查找并激活已存在的窗口
        HWND hExistingWnd = ::FindWindow(APP_NAME _T("InstallerWindow"), NULL);
        if (hExistingWnd != NULL)
        {
            // 如果窗口最小化，先恢复
            if (::IsIconic(hExistingWnd))
            {
                ::ShowWindow(hExistingWnd, SW_RESTORE);
            }
            // 将窗口置于前台并获取焦点
            ::SetForegroundWindow(hExistingWnd);
            ::BringWindowToTop(hExistingWnd);
        }
        
        if (hMutex)
            ::CloseHandle(hMutex);
        
        return 0;
    }

    HRESULT Hr = ::CoInitialize(NULL);
    if (FAILED(Hr))
    {
        if (hMutex)
            ::CloseHandle(hMutex);
        return 0;
    }

    CPaintManagerUI::SetInstance(hInstance);

    InitResource();

    CInstallerWnd *pFrame = new CInstallerWnd(updateMode, installPath);
    if (pFrame == NULL)
        return 0;

    pFrame->Create(NULL, _T("安装程序"), UI_WNDSTYLE_DIALOG, 0L, 0, 0, 600, 450);
    pFrame->CenterWindow();
    pFrame->ShowModal();

    ::CoUninitialize();
    
    // 释放互斥体资源
    if (hMutex)
        ::CloseHandle(hMutex);
    
    return 0;
}
