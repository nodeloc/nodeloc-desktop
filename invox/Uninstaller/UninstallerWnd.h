#pragma once
#include "..\DuiLib\UIlib.h"
#include <string>
#include <map>

using namespace DuiLib;

// 卸载主窗口
class CUninstallerWnd : public WindowImplBase
{
public:
    CUninstallerWnd();
    ~CUninstallerWnd();

public:
    virtual CDuiString GetSkinFile();
    virtual LPCTSTR GetWindowClassName() const;
    virtual void InitWindow();
    virtual void Notify(TNotifyUI& msg);
    virtual LRESULT OnCreate(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL& bHandled);
	LRESULT OnDestroy(UINT /*uMsg*/, WPARAM /*wParam*/, LPARAM /*lParam*/, BOOL& bHandled);
    virtual LRESULT HandleMessage(UINT uMsg, WPARAM wParam, LPARAM lParam);
    virtual LPCTSTR QueryControlText(LPCTSTR lpstrId, LPCTSTR lpstrType);
    
    // 静默卸载（不显示 UI）
    bool DoSilentUninstall();

protected:
    // 界面控件 - 第一页（反馈页面）
    COptionUI* m_pReasonOption1;
    COptionUI* m_pReasonOption2;
    COptionUI* m_pReasonOption3;
    CRichEditUI* m_pFeedbackEdit;
    CButtonUI* m_pUninstallBtn;
    
    // 界面控件 - 第二页（卸载进度页面）
    CProgressUI* m_pProgress;
    CLabelUI* m_pProgressText;
    
    // 界面控件 - 第三页（卸载完成页面）
    CLabelUI* m_pCompleteText;
    CButtonUI* m_pGoodbyeBtn;
    
    // 页面容器
    CContainerUI* m_pPage1;
    CContainerUI* m_pPage2;
    CContainerUI* m_pPage3;

private:
    // 切换页面
    void SwitchToPage(int pageIndex);
    
    // 开始卸载
    void StartUninstall();
    
    // 卸载线程函数
    static DWORD WINAPI UninstallThreadProc(LPVOID lpParam);
    void DoUninstall();
    
    // 更新进度
    void UpdateProgress(int percent, const std::wstring& text);
    
    // 获取本地化文本
    std::wstring GetLocalizedText(const std::wstring& textId);
    
    // 获取选中的卸载原因
    std::wstring GetSelectedReason();
    
    // 获取用户反馈
    std::wstring GetFeedback();
    
    // 自删除卸载程序
    void SelfDelete();
    
    // 通用方法：处理关联控件的点击事件
    void HandleRelatedControlClick(CControlUI* pControl);
    
    // 收集需要删除的文件和目录
    void CollectFilesAndDirectories(const std::wstring& rootPath, 
                                     std::vector<std::wstring>& files, 
                                     std::vector<std::wstring>& dirs);

private:
    std::wstring m_strInstallPath;
    HANDLE m_hUninstallThread;
    bool m_bUninstalling;
    std::wstring m_strReason;
    std::wstring m_strFeedback;
};
