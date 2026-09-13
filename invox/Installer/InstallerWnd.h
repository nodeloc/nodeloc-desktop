#pragma once
#include "..\DuiLib\UIlib.h"
#include "7zExtractor.h"
#include <string>

using namespace DuiLib;

// 安装主窗口
class CInstallerWnd : public WindowImplBase
{
public:
    CInstallerWnd(bool updateMode = false, const std::wstring& installPath = L"");
    ~CInstallerWnd();

public:
    virtual CDuiString GetSkinFile();
    virtual LPCTSTR GetWindowClassName() const;
    virtual void InitWindow();
    virtual void Notify(TNotifyUI& msg);
    virtual LRESULT OnCreate(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL& bHandled);
	LRESULT OnDestroy(UINT /*uMsg*/, WPARAM /*wParam*/, LPARAM /*lParam*/, BOOL& bHandled);
    virtual LRESULT HandleMessage(UINT uMsg, WPARAM wParam, LPARAM lParam);
    virtual LPCTSTR QueryControlText(LPCTSTR lpstrId, LPCTSTR lpstrType);

protected:
    // 标题栏
    CContainerUI* m_pTitleBar;
    
    // 页面容器
    CContainerUI* m_pPage1;
    CContainerUI* m_pPage2;
    CContainerUI* m_pPage3;
    CContainerUI* m_pPage4;
    
    // 界面控件 - 第一页（快速安装）
    CCheckBoxUI* m_pAgreeCheck;
    CButtonUI* m_pInstallBtn;
    CButtonUI* m_pSwitchCustomBtn;
    
    // 界面控件 - 第二页（自定义安装）
    CCheckBoxUI* m_pAgreeCheckCustom;
    CCheckBoxUI* m_pDesktopCheck;
    CButtonUI* m_pCustomInstallBtn;
    CButtonUI* m_pBrowseBtn;
    CEditUI* m_pPathEdit;
    CButtonUI* m_pSwitchQuickBtn;
    
    // 界面控件 - 第三页（安装进度）
    CProgressUI* m_pProgress;
    CLabelUI* m_pProgressText;
    
    // 界面控件 - 第四页（安装完成）
    CButtonUI* m_pLaunchBtn;

private:
    // 切换页面
    void SwitchToPage(int pageIndex);
    
    // 浏览安装路径
    void BrowseInstallPath();
    
    // 开始安装
    void StartInstall();
    
    // 安装线程函数
    static DWORD WINAPI InstallThreadProc(LPVOID lpParam);
    void DoInstall();
    
    // 更新进度
    void UpdateProgress(int percent, const std::wstring& text);
    
    // 获取本地化文本
    std::wstring GetLocalizedText(const std::wstring& textId);
    
    // 7z 解压进度回调
    static void OnExtractProgress(UINT64 bytesProcessed, UINT64 totalBytes, void* userData);
    
    // 启动应用
    void LaunchApplication();

    // 通用方法：处理关联控件的点击事件
    void HandleRelatedControlClick(CControlUI* pControl);
    
    // 回滚机制
    void RollbackInstallation();
    
    // 检测是否已安装
    bool IsApplicationInstalled(std::wstring& uninstallerPath);
    
    // 执行静默卸载
    bool ExecuteSilentUninstall(const std::wstring& uninstallerPath);
    
    // 抖动动画提醒
    void ShakeControl(CControlUI* pControl);
    static void CALLBACK ShakeTimerProc(HWND hwnd, UINT uMsg, UINT_PTR idEvent, DWORD dwTime);

private:
    // 安装步骤追踪
    enum InstallStep {
        STEP_NONE = 0,
        STEP_TEMP_DIR_CREATED,
        STEP_ARCHIVE_EXTRACTED,
        STEP_INSTALL_DIR_CREATED,
        STEP_FILES_EXTRACTED,
        STEP_START_MENU_CREATED,
        STEP_DESKTOP_SHORTCUT_CREATED,
        STEP_REGISTRY_WRITTEN,
        STEP_COMPLETED
    };
    
    InstallStep m_currentStep;
    std::wstring m_tempDir;
    std::wstring m_archivePath;
    bool m_startMenuCreated;
    bool m_desktopShortcutCreated;
    bool m_registryWritten;

private:
    std::wstring m_strInstallPath;
    HANDLE m_hInstallThread;
    bool m_bInstalling;
    bool m_bUpdateMode;
    UINT64 m_totalBytes;
    
    // 抖动动画相关
    CControlUI* m_pShakingControl;
    RECT m_shakeOriginalPos;
    int m_shakeStep;
    UINT_PTR m_shakeTimerId;
};
