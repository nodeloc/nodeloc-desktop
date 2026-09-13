#pragma once
#include "..\DuiLib\UIlib.h"

//////////////////////////////////////////////////////////////////////////
///
#define MSGID_OK     1
#define MSGID_CANCEL 0

class CMsgWnd : public WindowImplBase
{
public:
  static int MessageBox(HWND hParent, LPCTSTR lpstrMsg, LPCTSTR lpstrTitle = NULL)
  {
    CMsgWnd *pWnd = new CMsgWnd();
    pWnd->Create(hParent, _T("msgwnd"), WS_POPUP | WS_CLIPCHILDREN, WS_EX_TOOLWINDOW);
    pWnd->CenterWindow();
    pWnd->SetTitle(lpstrTitle);
    pWnd->SetMsg(lpstrMsg);
    return pWnd->ShowModal();
  }

  static int Confirm(HWND hParent, LPCTSTR lpstrMsg, LPCTSTR lpstrTitle = NULL,
                     LPCTSTR lpstrConfirmText = NULL, LPCTSTR lpstrCancelText = NULL)
  {
    CMsgWnd *pWnd = new CMsgWnd();
    pWnd->Create(hParent, _T("msgwnd"), WS_POPUP | WS_CLIPCHILDREN, WS_EX_TOOLWINDOW);
    pWnd->CenterWindow();
    pWnd->SetTitle(lpstrTitle);
    pWnd->SetMsg(lpstrMsg);
    pWnd->SetButtonText(lpstrConfirmText, lpstrCancelText);
    return pWnd->ShowModal();
  }

  static void Alert(HWND hParent, LPCTSTR lpstrMsg, LPCTSTR lpstrTitle = NULL,
                    LPCTSTR lpstrConfirmText = NULL)
  {
    CMsgWnd *pWnd = new CMsgWnd();
    pWnd->Create(hParent, _T("msgwnd"), WS_POPUP | WS_CLIPCHILDREN, WS_EX_TOOLWINDOW);
    pWnd->CenterWindow();
    pWnd->SetTitle(lpstrTitle);
    pWnd->SetMsg(lpstrMsg);
    pWnd->SetButtonText(lpstrConfirmText, NULL);
    pWnd->HideCancelButton();
    pWnd->ShowModal();
  }

  static void ShowMessageBox(HWND hParent, LPCTSTR lpstrMsg, LPCTSTR lpstrTitle = NULL)
  {
    CMsgWnd *pWnd = new CMsgWnd();
    pWnd->Create(hParent, _T("msgwnd"), UI_WNDSTYLE_FRAME, 0);
    pWnd->CenterWindow();
    pWnd->SetTitle(lpstrTitle);
    pWnd->SetMsg(lpstrMsg);
    pWnd->ShowWindow(true);
  }

public:
  CMsgWnd(void);
  ~CMsgWnd(void);

  void SetMsg(LPCTSTR lpstrMsg);
  void SetTitle(LPCTSTR lpstrTitle);
  void AdjustWindowHeight(CLabelUI *pText);
  void HideCancelButton();
  void SetButtonText(LPCTSTR lpstrConfirmText, LPCTSTR lpstrCancelText);

public:
  virtual void OnFinalMessage(HWND);
  virtual CDuiString GetSkinFile();
  virtual LPCTSTR GetWindowClassName(void) const;
  virtual void Notify(TNotifyUI &msg);
  virtual void InitWindow();

  DUI_DECLARE_MESSAGE_MAP()
  virtual void OnClick(TNotifyUI &msg);

  virtual LRESULT OnSysCommand(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL &bHandled);
  LRESULT HandleCustomMessage(UINT uMsg, WPARAM wParam, LPARAM lParam, BOOL &bHandled);

private:
  CButtonUI *m_pCloseBtn;
};
