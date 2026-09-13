#include "StdAfx.h"
#include "Analytics.h"
#include "Config.h"
#include <sstream>
#include <iomanip>
#include <rpc.h>

#pragma comment(lib, "Rpcrt4.lib")

CAnalytics* CAnalytics::m_pInstance = NULL;

CAnalytics::CAnalytics()
{
    m_strEndpoint = L"";
    m_strDeviceId = L"";
    m_strOSVersion = L"";
}

CAnalytics::~CAnalytics()
{
}

CAnalytics* CAnalytics::GetInstance()
{
    if (m_pInstance == NULL)
    {
        m_pInstance = new CAnalytics();
    }
    return m_pInstance;
}

void CAnalytics::SetEndpoint(const std::wstring& url)
{
    m_strEndpoint = url;
}

std::string CAnalytics::WStringToString(const std::wstring& wstr)
{
    if (wstr.empty()) return std::string();
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

std::wstring CAnalytics::StringToWString(const std::string& str)
{
    if (str.empty()) return std::wstring();
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), NULL, 0);
    std::wstring wstrTo(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), &wstrTo[0], size_needed);
    return wstrTo;
}

std::string CAnalytics::EscapeJsonString(const std::string& str)
{
    std::ostringstream oss;
    for (char ch : str)
    {
        switch (ch)
        {
        case '\\': oss << "\\\\"; break;
        case '\"': oss << "\\\""; break;
        case '\b': oss << "\\b"; break;
        case '\f': oss << "\\f"; break;
        case '\n': oss << "\\n"; break;
        case '\r': oss << "\\r"; break;
        case '\t': oss << "\\t"; break;
        default:
            if ('\x00' <= ch && ch <= '\x1f')
            {
                oss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)ch;
            }
            else
            {
                oss << ch;
            }
        }
    }
    return oss.str();
}

std::string CAnalytics::MapToJson(const std::map<std::wstring, std::wstring>& params)
{
    std::ostringstream oss;
    oss << "{";
    bool first = true;
    for (auto& pair : params)
    {
        if (!first) oss << ",";
        first = false;
        oss << "\"" << EscapeJsonString(WStringToString(pair.first)) << "\":\"" << EscapeJsonString(WStringToString(pair.second)) << "\"";
    }
    oss << "}";
    return oss.str();
}

bool CAnalytics::PostData(const std::wstring& url, const std::string& postData)
{
    if (url.empty()) return false;

    HINTERNET hInternet = NULL;
    HINTERNET hConnect = NULL;
    HINTERNET hRequest = NULL;
    bool bResult = false;

    try
    {
        // 初始化 WinINet
        hInternet = InternetOpen(L"InvoxSetupAnalytics/1.0", 
            INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
        if (!hInternet) return false;

        // 设置超时
        DWORD dwTimeout = 6000;
        InternetSetOption(hInternet, INTERNET_OPTION_CONNECT_TIMEOUT, &dwTimeout, sizeof(dwTimeout));
        InternetSetOption(hInternet, INTERNET_OPTION_SEND_TIMEOUT, &dwTimeout, sizeof(dwTimeout));
        InternetSetOption(hInternet, INTERNET_OPTION_RECEIVE_TIMEOUT, &dwTimeout, sizeof(dwTimeout));

        // 解析 URL
        URL_COMPONENTS urlComp = { 0 };
        urlComp.dwStructSize = sizeof(urlComp);
        WCHAR szHostName[256] = { 0 };
        WCHAR szUrlPath[1024] = { 0 };
        urlComp.lpszHostName = szHostName;
        urlComp.dwHostNameLength = 256;
        urlComp.lpszUrlPath = szUrlPath;
        urlComp.dwUrlPathLength = 1024;

        if (!InternetCrackUrl(url.c_str(), 0, 0, &urlComp))
        {
            InternetCloseHandle(hInternet);
            return false;
        }

        // 连接服务器
        hConnect = InternetConnect(hInternet, szHostName, urlComp.nPort,
            NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
        if (!hConnect)
        {
            InternetCloseHandle(hInternet);
            return false;
        }

        // 打开请求
        LPCTSTR rgpszAcceptTypes[] = { L"*/*", NULL };
        DWORD dwFlags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
        if (urlComp.nScheme == INTERNET_SCHEME_HTTPS)
            dwFlags |= INTERNET_FLAG_SECURE;

        hRequest = HttpOpenRequest(hConnect, L"POST", szUrlPath, NULL, NULL,
            rgpszAcceptTypes, dwFlags, 0);
        if (!hRequest)
        {
            InternetCloseHandle(hConnect);
            InternetCloseHandle(hInternet);
            return false;
        }

        // 设置请求头
        std::wstring headers = L"Content-Type: application/json\r\n";
        
        // 发送请求
        bResult = HttpSendRequest(hRequest, headers.c_str(), -1,
            (LPVOID)postData.c_str(), static_cast<DWORD>(postData.length())) == TRUE;

        // 清理
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
    }
    catch (...)
    {
        if (hRequest) InternetCloseHandle(hRequest);
        if (hConnect) InternetCloseHandle(hConnect);
        if (hInternet) InternetCloseHandle(hInternet);
        return false;
    }

    return bResult;
}

bool CAnalytics::ReportEvent(const std::wstring& eventType, const std::map<std::wstring, std::wstring>& params)
{
    if (m_strEndpoint.empty()) return false;

    std::map<std::wstring, std::wstring> fullParams = params;
    fullParams[L"event_type"] = eventType;
    
    // 添加设备唯一ID
    fullParams[L"device_id"] = GetDeviceId();

    // 添加应用名称
    fullParams[L"app_name"] = APP_NAME;
    
    // 添加应用版本
    fullParams[L"app_version"] = APP_VERSION;

    // 添加时间戳
    WCHAR szTime[64] = { 0 };
    SYSTEMTIME st;
    GetLocalTime(&st);
    wsprintf(szTime, L"%04d-%02d-%02d %02d:%02d:%02d", 
        st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
    fullParams[L"timestamp"] = szTime;

    std::string jsonData = MapToJson(fullParams);
    return PostData(m_strEndpoint, jsonData);
}

bool CAnalytics::ReportInstall(const std::wstring& installPath)
{
    std::map<std::wstring, std::wstring> params;
    params[L"install_path"] = installPath;
    
    // 获取系统版本信息（使用缓存）
    params[L"os_version"] = GetOSVersion();
    
    return ReportEvent(L"install", params);
}

bool CAnalytics::ReportUninstall(const std::wstring& reason, const std::wstring& feedback)
{
    std::map<std::wstring, std::wstring> params;
    params[L"reason"] = reason;
    params[L"feedback"] = feedback;
    
    return ReportEvent(L"uninstall", params);
}

std::wstring CAnalytics::GetDeviceId()
{
    // 如果已缓存，直接返回
    if (!m_strDeviceId.empty())
    {
        return m_strDeviceId;
    }
    
    // 尝试从注册表获取机器GUID
    HKEY hKey = NULL;
    LONG lResult = RegOpenKeyExW(HKEY_LOCAL_MACHINE,
        L"SOFTWARE\\Microsoft\\Cryptography",
        0, KEY_READ | KEY_WOW64_64KEY, &hKey);
    
    if (lResult == ERROR_SUCCESS)
    {
        WCHAR szGuid[256] = { 0 };
        DWORD dwType = REG_SZ;
        DWORD dwSize = sizeof(szGuid);
        
        lResult = RegQueryValueExW(hKey, L"MachineGuid", NULL, &dwType,
            (LPBYTE)szGuid, &dwSize);
        
        RegCloseKey(hKey);
        
        if (lResult == ERROR_SUCCESS && wcslen(szGuid) > 0)
        {
            m_strDeviceId = szGuid;
            return m_strDeviceId;
        }
    }
    
    // 如果无法获取机器GUID，生成一个基于计算机名和用户名的ID
    WCHAR szComputerName[MAX_COMPUTERNAME_LENGTH + 1] = { 0 };
    DWORD dwSize = MAX_COMPUTERNAME_LENGTH + 1;
    GetComputerNameW(szComputerName, &dwSize);
    
    WCHAR szUserName[256] = { 0 };
    dwSize = 256;
    GetUserNameW(szUserName, &dwSize);
    
    // 创建一个简单的哈希值作为设备ID
    std::wstring combined = szComputerName;
    combined += L"_";
    combined += szUserName;
    
    // 使用UUID生成唯一ID（作为备选方案）
    UUID uuid;
    if (UuidCreate(&uuid) == RPC_S_OK)
    {
        RPC_WSTR szUuid = NULL;
        if (UuidToStringW(&uuid, &szUuid) == RPC_S_OK)
        {
            m_strDeviceId = (LPWSTR)szUuid;
            RpcStringFreeW(&szUuid);
            return m_strDeviceId;
        }
    }
    
    // 最后的备选方案
    m_strDeviceId = combined;
    return m_strDeviceId;
}

std::wstring CAnalytics::GetOSVersion()
{
    // 如果已缓存，直接返回
    if (!m_strOSVersion.empty())
    {
        return m_strOSVersion;
    }
    
    // 从注册表读取系统版本信息（最准确且无警告）
    HKEY hKey = NULL;
    LONG lResult = RegOpenKeyExW(HKEY_LOCAL_MACHINE,
        L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
        0, KEY_READ | KEY_WOW64_64KEY, &hKey);
    
    if (lResult == ERROR_SUCCESS)
    {
        DWORD dwMajor = 0;
        DWORD dwMinor = 0;
        DWORD dwType = REG_DWORD;
        DWORD dwSize = sizeof(DWORD);
        
        // 读取主版本号
        RegQueryValueExW(hKey, L"CurrentMajorVersionNumber", NULL, &dwType, (LPBYTE)&dwMajor, &dwSize);
        
        // 读取次版本号
        dwSize = sizeof(DWORD);
        RegQueryValueExW(hKey, L"CurrentMinorVersionNumber", NULL, &dwType, (LPBYTE)&dwMinor, &dwSize);
        
        // 读取 Build Number 来区分 Windows 10 和 11
        WCHAR szBuild[64] = { 0 };
        dwType = REG_SZ;
        dwSize = sizeof(szBuild);
        RegQueryValueExW(hKey, L"CurrentBuild", NULL, &dwType, (LPBYTE)szBuild, &dwSize);
        
        // 读取 UBR (Update Build Revision)
        DWORD dwUBR = 0;
        dwType = REG_DWORD;
        dwSize = sizeof(DWORD);
        RegQueryValueExW(hKey, L"UBR", NULL, &dwType, (LPBYTE)&dwUBR, &dwSize);
        
        RegCloseKey(hKey);
        
        if (dwMajor > 0)
        {
            WCHAR szOSVersion[128] = { 0 };
            
            // Windows 11 的 Build >= 22000
            int buildNumber = _wtoi(szBuild);
            if (dwMajor == 10 && buildNumber >= 22000)
            {
                wsprintf(szOSVersion, L"Windows 11 (Build %s.%d)", szBuild, dwUBR);
            }
            else
            {
                wsprintf(szOSVersion, L"Windows %d.%d (Build %s.%d)", dwMajor, dwMinor, szBuild, dwUBR);
            }
            
            m_strOSVersion = szOSVersion;
            return m_strOSVersion;
        }
    }
    
    // 备选方案：返回默认值
    m_strOSVersion = L"Windows";
    return m_strOSVersion;
}
