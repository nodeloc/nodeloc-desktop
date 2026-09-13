#include "Logger.h"
#include <windows.h>
#include <time.h>
#include <stdarg.h>

CLogger* CLogger::m_pInstance = NULL;

CLogger::CLogger()
{
}

CLogger::~CLogger()
{
    if (m_logFile.is_open())
    {
        m_logFile.close();
    }
}

CLogger* CLogger::GetInstance()
{
    if (m_pInstance == NULL)
    {
        m_pInstance = new CLogger();
    }
    return m_pInstance;
}

void CLogger::SetLogFile(const std::wstring& logFilePath)
{
    std::lock_guard<std::mutex> lock(m_mutex);
    
    if (m_logFile.is_open())
    {
        m_logFile.close();
    }
    
    m_logFilePath = logFilePath;
    m_logFile.open(logFilePath, std::ios::app);
    
    if (m_logFile.is_open())
    {
        m_logFile << L"==================== Log Started ====================" << std::endl;
        m_logFile << L"Time: " << GetCurrentTimeString() << std::endl;
    }
}

void CLogger::Close()
{
    std::lock_guard<std::mutex> lock(m_mutex);
    
    if (m_logFile.is_open())
    {
        m_logFile << L"==================== Log Closed ====================" << std::endl;
        m_logFile.close();
    }
}

void CLogger::Log(LogLevel level, const std::wstring& message)
{
    std::lock_guard<std::mutex> lock(m_mutex);
    
    std::wstring logLine = L"[" + GetCurrentTimeString() + L"] [" + GetLevelString(level) + L"] " + message;
    
    // 写入文件
    if (m_logFile.is_open())
    {
        m_logFile << logLine << std::endl;
        m_logFile.flush();
    }
    
    // 输出到调试器
    OutputDebugString(logLine.c_str());
    OutputDebugString(L"\n");
}

void CLogger::LogInfo(const std::wstring& message)
{
    Log(LOG_INFO, message);
}

void CLogger::LogWarning(const std::wstring& message)
{
    Log(LOG_WARNING, message);
}

void CLogger::LogError(const std::wstring& message)
{
    Log(LOG_ERROR, message);
}

void CLogger::LogFormat(LogLevel level, const wchar_t* format, ...)
{
    wchar_t buffer[1024] = { 0 };
    
    va_list args;
    va_start(args, format);
    vswprintf_s(buffer, 1024, format, args);
    va_end(args);
    
    Log(level, buffer);
}

std::wstring CLogger::GetCurrentTimeString()
{
    SYSTEMTIME st;
    GetLocalTime(&st);
    
    wchar_t buffer[64] = { 0 };
    swprintf_s(buffer, 64, L"%04d-%02d-%02d %02d:%02d:%02d.%03d",
        st.wYear, st.wMonth, st.wDay,
        st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    
    return buffer;
}

std::wstring CLogger::GetLevelString(LogLevel level)
{
    switch (level)
    {
    case LOG_INFO:
        return L"INFO";
    case LOG_WARNING:
        return L"WARN";
    case LOG_ERROR:
        return L"ERROR";
    default:
        return L"UNKNOWN";
    }
}
