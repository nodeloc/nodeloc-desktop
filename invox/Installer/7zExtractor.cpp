#include "StdAfx.h"
#include "7zExtractor.h"
#include "7zStreamHelpers.h"
#include "..\Common\InstallHelper.h"
#include "resource.h"
#include <shlwapi.h>
#include <ShlObj.h>

#pragma comment(lib, "shlwapi.lib")

C7zExtractor::C7zExtractor(const std::wstring& str7zDllPath)
    : m_progressCallback(NULL)
    , m_pUserData(NULL)
    , m_h7zDll(NULL)
    , m_pfnCreateObject(NULL)
    , m_pArchive(NULL)
    , m_pFileStream(NULL)
    , m_archiveSize(0)
    , m_uncompressedSize(0)
    , m_fileCount(0)
{
    m_dllPath = str7zDllPath;
    
    // 初始化 COM
    CoInitialize(NULL);
    
    // 初始化 7zxa.dll
    Init7zDll();
}

C7zExtractor::~C7zExtractor()
{
    Close();
    Free7zDll();
    CoUninitialize();
}

void C7zExtractor::SetProgressCallback(ProgressCallback callback, void* userData)
{
    m_progressCallback = callback;
    m_pUserData = userData;
}

bool C7zExtractor::Init7zDll()
{
    if (m_dllPath.empty())
    {
        return false;
    }
    
    // 加载 7zxa.dll
    m_h7zDll = LoadLibrary(m_dllPath.c_str());
    if (!m_h7zDll)
    {
        return false;
    }
    
    // 获取 CreateObject 函数指针
    m_pfnCreateObject = (CreateObjectFunc)GetProcAddress(m_h7zDll, "CreateObject");
    if (!m_pfnCreateObject)
    {
        Free7zDll();
        return false;
    }
    
    return true;
}

void C7zExtractor::Free7zDll()
{
    if (m_h7zDll)
    {
        FreeLibrary(m_h7zDll);
        m_h7zDll = NULL;
    }
    
    m_pfnCreateObject = NULL;
}

bool C7zExtractor::Open(const std::wstring& archivePath)
{
    // 如果已经打开，先关闭
    Close();
    
    // 检查 7zxa.dll 是否已加载
    if (!m_h7zDll || !m_pfnCreateObject)
    {
        return false;
    }
    
    // 检查压缩包是否存在
    if (!PathFileExists(archivePath.c_str()))
    {
        return false;
    }
    
    // 保存压缩包路径
    m_archivePath = archivePath;
    
    // 获取压缩包文件大小
    WIN32_FILE_ATTRIBUTE_DATA fileInfo;
    if (GetFileAttributesEx(archivePath.c_str(), GetFileExInfoStandard, &fileInfo))
    {
        LARGE_INTEGER size;
        size.HighPart = fileInfo.nFileSizeHigh;
        size.LowPart = fileInfo.nFileSizeLow;
        m_archiveSize = size.QuadPart;
    }
    
    // 打开归档
    if (!OpenArchive())
    {
        Close();
        return false;
    }
    
    // 计算未压缩大小
    CalculateUncompressedSize();
    
    return true;
}

void C7zExtractor::Close()
{
    // 关闭归档
    if (m_pArchive)
    {
        m_pArchive->Close();
        m_pArchive->Release();
        m_pArchive = NULL;
    }
    
    // 关闭文件流
    if (m_pFileStream)
    {
        m_pFileStream->Release();
        m_pFileStream = NULL;
    }
    
    // 重置状态
    m_archivePath.clear();
    m_archiveSize = 0;
    m_uncompressedSize = 0;
    m_fileCount = 0;
}

bool C7zExtractor::IsOpen() const
{
    return m_pArchive != NULL;
}

UINT64 C7zExtractor::GetArchiveSize() const
{
    return m_archiveSize;
}

UINT64 C7zExtractor::GetUncompressedSize() const
{
    return m_uncompressedSize;
}

UInt32 C7zExtractor::GetFileCount() const
{
    return m_fileCount;
}

bool C7zExtractor::OpenArchive()
{
    // 创建归档处理器
    HRESULT hr = m_pfnCreateObject(&CLSID_CFormat7z, &IID_IInArchive, (void**)&m_pArchive);
    if (FAILED(hr) || !m_pArchive)
    {
        return false;
    }
    
    // 创建输入流
    m_pFileStream = new CInFileStream();
    if (!m_pFileStream->Open(m_archivePath.c_str()))
    {
        m_pFileStream->Release();
        m_pFileStream = NULL;
        m_pArchive->Release();
        m_pArchive = NULL;
        return false;
    }
    
    // 创建打开回调
    CArchiveOpenCallback* openCallback = new CArchiveOpenCallback();
    
    // 打开归档
    hr = m_pArchive->Open(m_pFileStream, NULL, openCallback);
    openCallback->Release();
    
    if (FAILED(hr))
    {
        m_pFileStream->Release();
        m_pFileStream = NULL;
        m_pArchive->Release();
        m_pArchive = NULL;
        return false;
    }
    
    // 获取文件数量
    m_pArchive->GetNumberOfItems(&m_fileCount);
    
    return true;
}

void C7zExtractor::CalculateUncompressedSize()
{
    if (!m_pArchive)
    {
        m_uncompressedSize = 0;
        return;
    }
    
    // 累加所有文件的未压缩大小
    UINT64 totalSize = 0;
    for (UInt32 i = 0; i < m_fileCount; i++)
    {
        // 获取文件大小属性
        PROPVARIANT prop;
        PropVariantInit(&prop);
        HRESULT hr = m_pArchive->GetProperty(i, kpidSize, &prop);
        
        if (SUCCEEDED(hr) && prop.vt == VT_UI8)
        {
            totalSize += prop.uhVal.QuadPart;
        }
        
        PropVariantClear(&prop);
    }
    
    m_uncompressedSize = totalSize;
}

bool C7zExtractor::Extract(const std::wstring& destPath)
{
    // 检查是否已打开
    if (!IsOpen())
    {
        return false;
    }
    
    // 创建目标目录
    SHCreateDirectoryExW(NULL, destPath.c_str(), NULL);
    
    // 创建解压回调
    CArchiveExtractCallback* extractCallback = new CArchiveExtractCallback();
    extractCallback->Init(m_pArchive, destPath);
    extractCallback->SetProgressCallback(m_progressCallback, m_pUserData);
    
    // 解压所有文件
    HRESULT hr = m_pArchive->Extract(NULL, (UInt32)-1, 0, extractCallback);
    
    // 清理
    extractCallback->Release();
    
    return SUCCEEDED(hr);
}
