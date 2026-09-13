#pragma once
#include "7zTypes.h"
#include <string>

// 文件输入流实现
class CInFileStream : public IInStream
{
public:
    CInFileStream();
    virtual ~CInFileStream();

    bool Open(const wchar_t* filename);
    void Close();

    // IUnknown
    STDMETHOD(QueryInterface)(REFIID iid, void** ppvObject);
    STDMETHOD_(ULONG, AddRef)();
    STDMETHOD_(ULONG, Release)();

    // ISequentialInStream
    STDMETHOD(Read)(void* data, UInt32 size, UInt32* processedSize);

    // IInStream
    STDMETHOD(Seek)(Int64 offset, UInt32 seekOrigin, UInt64* newPosition);

private:
    HANDLE m_hFile;
    LONG m_refCount;
};

// 文件输出流实现
class COutFileStream : public ISequentialOutStream
{
public:
    COutFileStream();
    virtual ~COutFileStream();

    bool Create(const wchar_t* filename, bool createAlways);
    void Close();

    // IUnknown
    STDMETHOD(QueryInterface)(REFIID iid, void** ppvObject);
    STDMETHOD_(ULONG, AddRef)();
    STDMETHOD_(ULONG, Release)();

    // ISequentialOutStream
    STDMETHOD(Write)(const void* data, UInt32 size, UInt32* processedSize);

private:
    HANDLE m_hFile;
    LONG m_refCount;
};

// 归档打开回调实现
class CArchiveOpenCallback : public IArchiveOpenCallback
{
public:
    CArchiveOpenCallback();
    virtual ~CArchiveOpenCallback();

    // IUnknown
    STDMETHOD(QueryInterface)(REFIID iid, void** ppvObject);
    STDMETHOD_(ULONG, AddRef)();
    STDMETHOD_(ULONG, Release)();

    // IArchiveOpenCallback
    STDMETHOD(SetTotal)(const UInt64* files, const UInt64* bytes);
    STDMETHOD(SetCompleted)(const UInt64* files, const UInt64* bytes);

private:
    LONG m_refCount;
};

// 归档解压回调实现
class CArchiveExtractCallback : public IArchiveExtractCallback
{
public:
    CArchiveExtractCallback();
    virtual ~CArchiveExtractCallback();

    void Init(IInArchive* archiveHandler, const std::wstring& directoryPath);
    void SetProgressCallback(void (*callback)(UINT64, UINT64, void*), void* userData);

    // IUnknown
    STDMETHOD(QueryInterface)(REFIID iid, void** ppvObject);
    STDMETHOD_(ULONG, AddRef)();
    STDMETHOD_(ULONG, Release)();

    // IArchiveExtractCallback
    STDMETHOD(SetTotal)(UInt64 total);
    STDMETHOD(SetCompleted)(const UInt64* completeValue);
    STDMETHOD(GetStream)(UInt32 index, ISequentialOutStream** outStream, Int32 askExtractMode);
    STDMETHOD(PrepareOperation)(Int32 askExtractMode);
    STDMETHOD(SetOperationResult)(Int32 resultEOperationResult);

private:
    LONG m_refCount;
    IInArchive* m_archiveHandler;
    std::wstring m_directoryPath;
    COutFileStream* m_outFileStream;
    std::wstring m_filePath;
    bool m_isDir;
    UINT64 m_total;
    
    void (*m_progressCallback)(UINT64, UINT64, void*);
    void* m_pUserData;
    
    bool GetPropertyString(UInt32 index, PROPID propID, std::wstring& result);
    bool GetPropertyBool(UInt32 index, PROPID propID, bool& result);
};