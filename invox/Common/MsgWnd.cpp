#include "StdAfx.h"
#include "MsgWnd.h"

//////////////////////////////////////////////////////////////////////////
///

DUI_BEGIN_MESSAGE_MAP(CMsgWnd, WindowImplBase)
DUI_ON_MSGTYPE(DUI_MSGTYPE_CLICK, OnClick)
DUI_END_MESSAGE_MAP()

CMsgWnd::CMsgWnd(void)
{
}

CMsgWnd::~CMsgWnd(void)
{
}

void CMsgWnd::SetTitle(LPCTSTR lpstrTitle)
{
    if (lstrlen(lpstrTitle) <= 0)
        return;

    CControlUI *pText = static_cast<CControlUI *>(m_pm.FindControl(_T("message_title")));
    if (pText)
        pText->SetText(lpstrTitle);
}

void CMsgWnd::SetMsg(LPCTSTR lpstrMsg)
{
    if (lstrlen(lpstrMsg) <= 0)
        return;

    CLabelUI *pText = static_cast<CLabelUI *>(m_pm.FindControl(_T("message_text")));
    if (pText)
    {
        if (pText->IsResourceText()) {
            pText->SetText(CResourceManager::GetInstance()->GetText(lpstrMsg));
        } else {
            pText->SetText(lpstrMsg);
        }
        // 设置文本后调整窗口高度
        AdjustWindowHeight(pText);
    }
}

void CMsgWnd::AdjustWindowHeight(CLabelUI *pText)
{
    CContainerUI *pTextContainer = static_cast<CContainerUI *>(m_pm.FindControl(_T("body")));
    if (!pText || !pTextContainer)
        return;

    // 获取文本控件的字体
    UINT dwTextStyle = pText->GetTextStyle();
    int nFont = pText->GetFont();
    CDuiString sText = pText->GetText();
    
    if (sText.IsEmpty())
        return;

    // 获取绘制上下文
    HDC hDC = ::GetDC(m_hWnd);
    if (!hDC)
        return;

    // 设置字体
    HFONT hFont = m_pm.GetFont(nFont);
    HFONT hOldFont = (HFONT)::SelectObject(hDC, hFont);
    
    // 获取文本容器的内边距
    RECT rcContainerPadding = pTextContainer->GetPadding();

    // 获取当前窗口宽度，计算文本区域宽度
    RECT rcWnd;
    ::GetWindowRect(m_hWnd, &rcWnd);
    int nWindowWidth = rcWnd.right - rcWnd.left;
    
    // 文本宽度 = 窗口宽度 - 容器左右内边距 - 文本控件左右内边距
    int nTextWidth = nWindowWidth
                     - rcContainerPadding.left - rcContainerPadding.right;
    
    // 计算文本所需高度
    RECT rcText = { 0, 0, nTextWidth, 9999 };
    ::DrawText(hDC, sText, -1, &rcText, DT_CALCRECT | DT_WORDBREAK | dwTextStyle);
    int nTextHeight = rcText.bottom - rcText.top;

    // 恢复字体
    ::SelectObject(hDC, hOldFont);
    ::ReleaseDC(m_hWnd, hDC);

    // 获取标题栏高度
    CControlUI *pTitleBar = static_cast<CControlUI *>(m_pm.FindControl(_T("titlebar")));
    int nTitleBarHeight = pTitleBar ? pTitleBar->GetFixedHeight() : 0;
    
    // 获取按钮区域的高度
    CControlUI *pFooter = static_cast<CControlUI *>(m_pm.FindControl(_T("footer")));
    int nFooterHeight = pFooter ? pFooter->GetFixedHeight() : 0;
    
    // 计算新的窗口高度 = 标题栏 + 消息内容 + 页脚
    int nMinTextHeight = 20; // 最小文本区域高度
    int nActualTextHeight = max(nTextHeight, nMinTextHeight);
    nActualTextHeight += rcContainerPadding.top + rcContainerPadding.bottom;
    int nNewWindowHeight = nTitleBarHeight + nActualTextHeight + nFooterHeight;

    // 限制窗口高度范围
    int nMinWindowHeight = 136;
    int nMaxWindowHeight = 600;
    nNewWindowHeight = max(nMinWindowHeight, min(nNewWindowHeight, nMaxWindowHeight));

    // 调整窗口大小
    ::SetWindowPos(m_hWnd, NULL, 0, 0, nWindowWidth, nNewWindowHeight, SWP_NOMOVE | SWP_NOZORDER);
    // 重新设置窗口大小并居中
    CenterWindow();
}

void CMsgWnd::HideCancelButton()
{
    CButtonUI *pCancelBtn = static_cast<CButtonUI *>(m_pm.FindControl(_T("cancel_btn")));
    if (pCancelBtn)
    {
        pCancelBtn->SetVisible(false);
    }
}

void CMsgWnd::SetButtonText(LPCTSTR lpstrConfirmText, LPCTSTR lpstrCancelText)
{
    // 设置确认按钮文本
    if (lpstrConfirmText != NULL && lstrlen(lpstrConfirmText) > 0)
    {
        CButtonUI *pConfirmBtn = static_cast<CButtonUI *>(m_pm.FindControl(_T("confirm_btn")));
        if (pConfirmBtn)
        {
            pConfirmBtn->SetText(lpstrConfirmText);
        }
    }

    // 设置取消按钮文本
    if (lpstrCancelText != NULL && lstrlen(lpstrCancelText) > 0)
    {
        CButtonUI *pCancelBtn = static_cast<CButtonUI *>(m_pm.FindControl(_T("cancel_btn")));
        if (pCancelBtn)
        {
            pCancelBtn->SetText(lpstrCancelText);
        }
    }
}

void CMsgWnd::OnFinalMessage(HWND hWnd)
{
    __super::OnFinalMessage(hWnd);
    delete this;
}

DuiLib::CDuiString CMsgWnd::GetSkinFile()
{
    return _T("XML_MSG");
}

LPCTSTR CMsgWnd::GetWindowClassName(void) const
{
    return _T("MsgWnd");
}

void CMsgWnd::OnClick(TNotifyUI &msg)
{
    CDuiString sName = msg.pSender->GetName();
    sName.MakeLower();

    if (msg.pSender == m_pCloseBtn)
    {
        Close(MSGID_CANCEL);
        return;
    }
    else if (sName.CompareNoCase(_T("confirm_btn")) == 0)
    {
        Close(MSGID_OK);
    }
    else if (sName.CompareNoCase(_T("cancel_btn")) == 0)
    {
        Close(MSGID_CANCEL);
    }
}

LRESULT CMsgWnd::HandleCustomMessage(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL &bHandled)
{
    bHandled = FALSE;
    return 0;
}

void CMsgWnd::Notify(TNotifyUI &msg)
{
    return WindowImplBase::Notify(msg);
}

LRESULT CMsgWnd::OnSysCommand(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL &bHandled)
{
    bHandled = FALSE;
    return 0L;
}

void CMsgWnd::InitWindow()
{
    m_pCloseBtn = static_cast<CButtonUI *>(m_pm.FindControl(_T("closebtn")));
}
