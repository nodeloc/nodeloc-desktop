#pragma once
#include <windows.h>
#include <string>
#include <fstream>
#include <mutex>

// 日志级别
enum LogLevel
{
    LOG_INFO,
    LOG_WARNING,
    LOG_ERROR
};

// 日志记录器
class CLogger
{
public:
    static CLogger* GetInstance();
    
    // 设置日志文件路径
    void SetLogFile(const std::wstring& logFilePath);
    
    // 记录日志
    void Log(LogLevel level, const std::wstring& message);
    void LogInfo(const std::wstring& message);
    void LogWarning(const std::wstring& message);
    void LogError(const std::wstring& message);
    
    // 格式化日志
    void LogFormat(LogLevel level, const wchar_t* format, ...);
    
    // 关闭日志文件
    void Close();
    
private:
    CLogger();
    ~CLogger();
    
    static CLogger* m_pInstance;
    std::wstring m_logFilePath;
    std::wofstream m_logFile;
    std::mutex m_mutex;
    
    std::wstring GetCurrentTimeString();
    std::wstring GetLevelString(LogLevel level);
};
