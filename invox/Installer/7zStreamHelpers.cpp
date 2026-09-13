#include "StdAfx.h"
#include "7zStreamHelpers.h"
#include <ShlObj.h>
#include <shlwapi.h>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "ole32.lib")

// CInFileStream 实现
CInFileStream::CInFileStream()
    : m_hFile(INVALID_HANDLE_VALUE)
    , m_refCount(1)
{
}

CInFileStream::~CInFileStream()
{
    Close();
}

bool CInFileStream::Open(const wchar_t* filename)
{
    Close();
    m_hFile = CreateFileW(filename, GENERIC_READ, FILE_SHARE_READ, NULL,
        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    return m_hFile != INVALID_HANDLE_VALUE;
}

void CInFileStream::Close()
{
    if (m_hFile != INVALID_HANDLE_VALUE)
    {
        CloseHandle(m_hFile);
        m_hFile = INVALID_HANDLE_VALUE;
    }
}

STDMETHODIMP CInFileStream::QueryInterface(REFIID iid, void** ppvObject)
{
    if (!ppvObject)
        return E_POINTER;
    
    if (iid == IID_IUnknown || iid == IID_ISequentialInStream || iid == IID_IInStream)
    {
        *ppvObject = static_cast<IInStream*>(this);
        AddRef();
        return S_OK;
    }
    
    *ppvObject = NULL;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) CInFileStream::AddRef()
{
    return InterlockedIncrement(&m_refCount);
}

STDMETHODIMP_(ULONG) CInFileStream::Release()
{
    LONG count = InterlockedDecrement(&m_refCount);
    if (count == 0)
        delete this;
    return count;
}

STDMETHODIMP CInFileStream::Read(void* data, UInt32 size, UInt32* processedSize)
{
    DWORD read = 0;
    if (!ReadFile(m_hFile, data, size, &read, NULL))
        return HRESULT_FROM_WIN32(GetLastError());
    
    if (processedSize)
        *processedSize = read;
    return S_OK;
}

STDMETHODIMP CInFileStream::Seek(Int64 offset, UInt32 seekOrigin, UInt64* newPosition)
{
    LARGE_INTEGER move;
    move.QuadPart = offset;
    
    LARGE_INTEGER newPos;
    if (!SetFilePointerEx(m_hFile, move, &newPos, seekOrigin))
        return HRESULT_FROM_WIN32(GetLastError());
    
    if (newPosition)
        *newPosition = newPos.QuadPart;
    return S_OK;
}

// COutFileStream 实现
COutFileStream::COutFileStream()
    : m_hFile(INVALID_HANDLE_VALUE)
    , m_refCount(1)
{
}

COutFileStream::~COutFileStream()
{
    Close();
}

bool COutFileStream::Create(const wchar_t* filename, bool createAlways)
{
    Close();
    m_hFile = CreateFileW(filename, GENERIC_WRITE, 0, NULL,
        createAlways ? CREATE_ALWAYS : CREATE_NEW,
        FILE_ATTRIBUTE_NORMAL, NULL);
    return m_hFile != INVALID_HANDLE_VALUE;
}

void COutFileStream::Close()
{
    if (m_hFile != INVALID_HANDLE_VALUE)
    {
        CloseHandle(m_hFile);
        m_hFile = INVALID_HANDLE_VALUE;
    }
}

STDMETHODIMP COutFileStream::QueryInterface(REFIID iid, void** ppvObject)
{
    if (!ppvObject)
        return E_POINTER;
    
    if (iid == IID_IUnknown || iid == IID_ISequentialOutStream)
    {
        *ppvObject = static_cast<ISequentialOutStream*>(this);
        AddRef();
        return S_OK;
    }
    
    *ppvObject = NULL;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) COutFileStream::AddRef()
{
    return InterlockedIncrement(&m_refCount);
}

STDMETHODIMP_(ULONG) COutFileStream::Release()
{
    LONG count = InterlockedDecrement(&m_refCount);
    if (count == 0)
        delete this;
    return count;
}

STDMETHODIMP COutFileStream::Write(const void* data, UInt32 size, UInt32* processedSize)
{
    DWORD written = 0;
    if (!WriteFile(m_hFile, data, size, &written, NULL))
        return HRESULT_FROM_WIN32(GetLastError());
    
    if (processedSize)
        *processedSize = written;
    return S_OK;
}

// CArchiveOpenCallback 实现
CArchiveOpenCallback::CArchiveOpenCallback()
    : m_refCount(1)
{
}

CArchiveOpenCallback::~CArchiveOpenCallback()
{
}

STDMETHODIMP CArchiveOpenCallback::QueryInterface(REFIID iid, void** ppvObject)
{
    if (!ppvObject)
        return E_POINTER;
    
    if (iid == IID_IUnknown || iid == IID_IArchiveOpenCallback)
    {
        *ppvObject = static_cast<IArchiveOpenCallback*>(this);
        AddRef();
        return S_OK;
    }
    
    *ppvObject = NULL;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) CArchiveOpenCallback::AddRef()
{
    return InterlockedIncrement(&m_refCount);
}

STDMETHODIMP_(ULONG) CArchiveOpenCallback::Release()
{
    LONG count = InterlockedDecrement(&m_refCount);
    if (count == 0)
        delete this;
    return count;
}

STDMETHODIMP CArchiveOpenCallback::SetTotal(const UInt64* files, const UInt64* bytes)
{
    return S_OK;
}

STDMETHODIMP CArchiveOpenCallback::SetCompleted(const UInt64* files, const UInt64* bytes)
{
    return S_OK;
}

// CArchiveExtractCallback 实现
CArchiveExtractCallback::CArchiveExtractCallback()
    : m_refCount(1)
    , m_archiveHandler(NULL)
    , m_outFileStream(NULL)
    , m_isDir(false)
    , m_total(0)
    , m_progressCallback(NULL)
    , m_pUserData(NULL)
{
}

CArchiveExtractCallback::~CArchiveExtractCallback()
{
    if (m_outFileStream)
    {
        m_outFileStream->Release();
        m_outFileStream = NULL;
    }
}

void CArchiveExtractCallback::Init(IInArchive* archiveHandler, const std::wstring& directoryPath)
{
    m_archiveHandler = archiveHandler;
    m_directoryPath = directoryPath;
}

void CArchiveExtractCallback::SetProgressCallback(void (*callback)(UINT64, UINT64, void*), void* userData)
{
    m_progressCallback = callback;
    m_pUserData = userData;
}

STDMETHODIMP CArchiveExtractCallback::QueryInterface(REFIID iid, void** ppvObject)
{
    if (!ppvObject)
        return E_POINTER;
    
    if (iid == IID_IUnknown || iid == IID_IArchiveExtractCallback)
    {
        *ppvObject = static_cast<IArchiveExtractCallback*>(this);
        AddRef();
        return S_OK;
    }
    
    *ppvObject = NULL;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) CArchiveExtractCallback::AddRef()
{
    return InterlockedIncrement(&m_refCount);
}

STDMETHODIMP_(ULONG) CArchiveExtractCallback::Release()
{
    LONG count = InterlockedDecrement(&m_refCount);
    if (count == 0)
        delete this;
    return count;
}

STDMETHODIMP CArchiveExtractCallback::SetTotal(UInt64 total)
{
    m_total = total;
    return S_OK;
}

STDMETHODIMP CArchiveExtractCallback::SetCompleted(const UInt64* completeValue)
{
    if (m_progressCallback && completeValue)
    {
        m_progressCallback(*completeValue, m_total, m_pUserData);
    }
    return S_OK;
}

bool CArchiveExtractCallback::GetPropertyString(UInt32 index, PROPID propID, std::wstring& result)
{
    PROPVARIANT prop;
    PropVariantInit(&prop);
    
    if (FAILED(m_archiveHandler->GetProperty(index, propID, &prop)))
    {
        PropVariantClear(&prop);
        return false;
    }
    
    if (prop.vt == VT_BSTR)
    {
        result = prop.bstrVal;
    }
    else
    {
        result.clear();
    }
    
    PropVariantClear(&prop);
    return true;
}

bool CArchiveExtractCallback::GetPropertyBool(UInt32 index, PROPID propID, bool& result)
{
    PROPVARIANT prop;
    PropVariantInit(&prop);
    
    if (FAILED(m_archiveHandler->GetProperty(index, propID, &prop)))
    {
        PropVariantClear(&prop);
        return false;
    }
    
    // 处理多种可能的布尔值表示方式
    switch (prop.vt)
    {
        case VT_BOOL:
            result = (prop.boolVal != VARIANT_FALSE);
            break;
        case VT_UI1:
            result = (prop.bVal != 0);
            break;
        case VT_UI2:
            result = (prop.uiVal != 0);
            break;
        case VT_UI4:
            result = (prop.ulVal != 0);
            break;
        case VT_I1:
            result = (prop.cVal != 0);
            break;
        case VT_I2:
            result = (prop.iVal != 0);
            break;
        case VT_I4:
            result = (prop.lVal != 0);
            break;
        case VT_EMPTY:
        default:
            result = false;
            break;
    }
    
    PropVariantClear(&prop);
    return true;
}

STDMETHODIMP CArchiveExtractCallback::GetStream(UInt32 index, ISequentialOutStream** outStream, Int32 askExtractMode)
{
    *outStream = NULL;
    
    // 清理之前的流
    if (m_outFileStream)
    {
        m_outFileStream->Release();
        m_outFileStream = NULL;
    }
    
    // 获取文件路径
    std::wstring path;
    if (!GetPropertyString(index, kpidPath, path))
    {
        OutputDebugStringW(L"[7z] Failed to get file path\n");
        return E_FAIL;
    }
    
    // 尝试获取是否为目录属性
    m_isDir = false;
    GetPropertyBool(index, kpidIsDir, m_isDir);
    
    // 构建完整路径
    m_filePath = m_directoryPath;
    if (!m_filePath.empty() && m_filePath[m_filePath.length() - 1] != L'\\')
        m_filePath += L'\\';
    m_filePath += path;
        
    if (askExtractMode != NArchive::NExtract::NAskMode::kExtract)
        return S_OK;
    
    if (m_isDir)
    {
        // 创建目录
        HRESULT hr = SHCreateDirectoryExW(NULL, m_filePath.c_str(), NULL);
        if (FAILED(hr) && hr != HRESULT_FROM_WIN32(ERROR_ALREADY_EXISTS))
        {
            // 目录创建失败，但如果是已存在则忽略错误
            WCHAR errMsg[256];
            swprintf_s(errMsg, L"[7z] Failed to create directory: %s (HR=0x%08X)\n", m_filePath.c_str(), hr);
            OutputDebugStringW(errMsg);
            return hr;
        }
        return S_OK;
    }
    
    // 确保父目录存在
    std::wstring dirPath = m_filePath;
    size_t pos = dirPath.find_last_of(L'\\');
    if (pos != std::wstring::npos)
    {
        dirPath = dirPath.substr(0, pos);
        HRESULT hr = SHCreateDirectoryExW(NULL, dirPath.c_str(), NULL);
        if (FAILED(hr) && hr != HRESULT_FROM_WIN32(ERROR_ALREADY_EXISTS))
        {
            // 目录创建失败
            WCHAR errMsg[256];
            swprintf_s(errMsg, L"[7z] Failed to create parent directory: %s (HR=0x%08X)\n", dirPath.c_str(), hr);
            OutputDebugStringW(errMsg);
            return hr;
        }
    }
    
    // 创建输出流
    m_outFileStream = new COutFileStream();
    if (!m_outFileStream->Create(m_filePath.c_str(), true))
    {
        DWORD dwError = GetLastError();
        
        // 检查是否因为路径已经是目录而失败
        DWORD fileAttrib = GetFileAttributesW(m_filePath.c_str());
        if (fileAttrib != INVALID_FILE_ATTRIBUTES && (fileAttrib & FILE_ATTRIBUTE_DIRECTORY))
        {
            WCHAR errMsg[512];
            swprintf_s(errMsg, L"[7z] Path already exists as directory: %s - This might be a misdetected directory entry\n", m_filePath.c_str());
            OutputDebugStringW(errMsg);
            
            // 这个条目实际上应该是目录，但被误判为文件
            // 跳过它，不报错
            m_outFileStream->Release();
            m_outFileStream = NULL;
            return S_OK;  // 返回成功，跳过这个条目
        }
        
        WCHAR errMsg[256];
        swprintf_s(errMsg, L"[7z] Failed to create file: %s (Error=%d)\n", m_filePath.c_str(), dwError);
        OutputDebugStringW(errMsg);
        m_outFileStream->Release();
        m_outFileStream = NULL;
        return HRESULT_FROM_WIN32(dwError);
    }
    
    *outStream = m_outFileStream;
    m_outFileStream->AddRef();
    
    return S_OK;
}

STDMETHODIMP CArchiveExtractCallback::PrepareOperation(Int32 askExtractMode)
{
    return S_OK;
}

STDMETHODIMP CArchiveExtractCallback::SetOperationResult(Int32 resultEOperationResult)
{
    if (m_outFileStream)
    {
        m_outFileStream->Close();
        m_outFileStream->Release();
        m_outFileStream = NULL;
    }
    
    return S_OK;
}
