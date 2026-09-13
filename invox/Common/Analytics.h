#pragma once
#include <windows.h>
#include <wininet.h>
#include <string>
#include <map>

#pragma comment(lib, "wininet.lib")

// 分析上报类
class CAnalytics
{
public:
    static CAnalytics* GetInstance();
    
    // 设置 API 端点
    void SetEndpoint(const std::wstring& url);
    
    // 上报事件
    bool ReportEvent(const std::wstring& eventType, const std::map<std::wstring, std::wstring>& params);
    
    // 上报安装事件
    bool ReportInstall(const std::wstring& installPath);
    
    // 上报卸载事件
    bool ReportUninstall(const std::wstring& reason, const std::wstring& feedback);

private:
    CAnalytics();
    ~CAnalytics();
    
    // 执行 HTTP POST 请求
    bool PostData(const std::wstring& url, const std::string& postData);
    
    // 将参数转换为 JSON 格式
    std::string MapToJson(const std::map<std::wstring, std::wstring>& params);
    
    // JSON 字符串转义
    std::string EscapeJsonString(const std::string& str);
    
    // 字符串转换
    std::string WStringToString(const std::wstring& wstr);
    std::wstring StringToWString(const std::string& str);
    
    // 获取设备唯一ID
    std::wstring GetDeviceId();
    
    // 获取操作系统版本
    std::wstring GetOSVersion();

private:
    static CAnalytics* m_pInstance;
    std::wstring m_strEndpoint;
    std::wstring m_strDeviceId; // 缓存设备ID
    std::wstring m_strOSVersion; // 缓存系统版本
};
