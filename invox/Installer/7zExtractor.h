#pragma once
#include <windows.h>
#include <string>
#include "7zTypes.h"

// 前向声明
class CInFileStream;

// 7z 解压辅助类
class C7zExtractor
{
public:
    C7zExtractor(const std::wstring& str7zDllPath);
    ~C7zExtractor();

    // 设置回调函数用于更新进度
    typedef void (*ProgressCallback)(UINT64 bytesProcessed, UINT64 totalBytes, void* userData);
    void SetProgressCallback(ProgressCallback callback, void* userData);
    
    // 打开压缩包
    // archivePath: 7z 压缩包路径
    // 返回: 成功返回 true，失败返回 false
    bool Open(const std::wstring& archivePath);
    
    // 关闭压缩包
    void Close();
    
    // 检查是否已打开
    bool IsOpen() const;
    
    // 解压文件到指定目录
    // destPath: 目标解压路径
    // 返回: 成功返回 true，失败返回 false
    bool Extract(const std::wstring& destPath);

    // 获取压缩包文件大小（压缩后的大小）
    UINT64 GetArchiveSize() const;
    
    // 获取压缩包解压后的总大小
    // 返回: 解压后的总大小（字节），失败返回 0
    UINT64 GetUncompressedSize() const;
    
    // 获取压缩包中的文件数量
    UInt32 GetFileCount() const;

private:
    ProgressCallback m_progressCallback;
    void* m_pUserData;

    // zxa.dll 路径
    std::wstring m_dllPath;
    
    // 7zxa.dll 动态库句柄
    HMODULE m_h7zDll;
    
    // CreateObject 函数指针
    CreateObjectFunc m_pfnCreateObject;
    
    // 压缩包相关
    std::wstring m_archivePath;         // 压缩包路径
    IInArchive* m_pArchive;             // 归档处理器
    CInFileStream* m_pFileStream;       // 文件流
    UINT64 m_archiveSize;               // 压缩包文件大小
    UINT64 m_uncompressedSize;          // 解压后总大小
    UInt32 m_fileCount;                 // 文件数量
    
    // 初始化 7zxa.dll
    bool Init7zDll();
    
    // 释放 7zxa.dll
    void Free7zDll();
    
    // 内部实现：打开归档
    bool OpenArchive();
    
    // 内部实现：计算未压缩大小
    void CalculateUncompressedSize();
};
