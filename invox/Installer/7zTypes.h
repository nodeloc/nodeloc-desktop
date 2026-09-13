#pragma once
#include <windows.h>
#include <unknwn.h>

// 基本类型定义
typedef unsigned char Byte;
typedef unsigned short UInt16;
typedef unsigned int UInt32;
typedef unsigned long long UInt64;
typedef int Int32;
typedef long long Int64;

// 7zxa.dll COM 接口定义

// GUID 定义
static const GUID CLSID_CFormat7z = 
{ 0x23170F69, 0x40C1, 0x278A, { 0x10, 0x00, 0x00, 0x01, 0x10, 0x07, 0x00, 0x00 } };

static const GUID IID_IInArchive = 
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x06, 0x00, 0x60, 0x00, 0x00 } };

static const GUID IID_IArchiveOpenCallback =
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x06, 0x00, 0x10, 0x00, 0x00 } };

static const GUID IID_IArchiveExtractCallback =
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x06, 0x00, 0x20, 0x00, 0x00 } };

static const GUID IID_ISequentialInStream =
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00 } };

static const GUID IID_IInStream =
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x03, 0x00, 0x03, 0x00, 0x00 } };

static const GUID IID_ISequentialOutStream =
{ 0x23170F69, 0x40C1, 0x278A, { 0x00, 0x00, 0x00, 0x03, 0x00, 0x02, 0x00, 0x00 } };

// 前向声明
interface ISequentialInStream;
interface IInStream;
interface ISequentialOutStream;
interface IArchiveOpenCallback;
interface IArchiveExtractCallback;
interface IInArchive;

// ISequentialInStream 接口
#undef INTERFACE
#define INTERFACE ISequentialInStream
DECLARE_INTERFACE_(ISequentialInStream, IUnknown)
{
    STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize) PURE;
};

// IInStream 接口
#undef INTERFACE
#define INTERFACE IInStream
DECLARE_INTERFACE_(IInStream, ISequentialInStream)
{
    STDMETHOD(Seek)(Int64 offset, UInt32 seekOrigin, UInt64 *newPosition) PURE;
};

// ISequentialOutStream 接口
#undef INTERFACE
#define INTERFACE ISequentialOutStream
DECLARE_INTERFACE_(ISequentialOutStream, IUnknown)
{
    STDMETHOD(Write)(const void *data, UInt32 size, UInt32 *processedSize) PURE;
};

// IArchiveOpenCallback 接口
#undef INTERFACE
#define INTERFACE IArchiveOpenCallback
DECLARE_INTERFACE_(IArchiveOpenCallback, IUnknown)
{
    STDMETHOD(SetTotal)(const UInt64 *files, const UInt64 *bytes) PURE;
    STDMETHOD(SetCompleted)(const UInt64 *files, const UInt64 *bytes) PURE;
};

// IArchiveExtractCallback 接口
#undef INTERFACE
#define INTERFACE IArchiveExtractCallback
DECLARE_INTERFACE_(IArchiveExtractCallback, IUnknown)
{
    STDMETHOD(SetTotal)(UInt64 total) PURE;
    STDMETHOD(SetCompleted)(const UInt64 *completeValue) PURE;
    STDMETHOD(GetStream)(UInt32 index, ISequentialOutStream **outStream, Int32 askExtractMode) PURE;
    STDMETHOD(PrepareOperation)(Int32 askExtractMode) PURE;
    STDMETHOD(SetOperationResult)(Int32 resultEOperationResult) PURE;
};

// IInArchive 接口
#undef INTERFACE
#define INTERFACE IInArchive
DECLARE_INTERFACE_(IInArchive, IUnknown)
{
    STDMETHOD(Open)(IInStream *stream, const UInt64 *maxCheckStartPosition, IArchiveOpenCallback *openCallback) PURE;
    STDMETHOD(Close)() PURE;
    STDMETHOD(GetNumberOfItems)(UInt32 *numItems) PURE;
    STDMETHOD(GetProperty)(UInt32 index, PROPID propID, PROPVARIANT *value) PURE;
    STDMETHOD(Extract)(const UInt32 *indices, UInt32 numItems, Int32 testMode, IArchiveExtractCallback *extractCallback) PURE;
    STDMETHOD(GetArchiveProperty)(PROPID propID, PROPVARIANT *value) PURE;
    STDMETHOD(GetNumberOfProperties)(UInt32 *numProps) PURE;
    STDMETHOD(GetPropertyInfo)(UInt32 index, BSTR *name, PROPID *propID, VARTYPE *varType) PURE;
    STDMETHOD(GetNumberOfArchiveProperties)(UInt32 *numProps) PURE;
    STDMETHOD(GetArchivePropertyInfo)(UInt32 index, BSTR *name, PROPID *propID, VARTYPE *varType) PURE;
};

// 7zxa.dll 导出函数类型
typedef HRESULT (STDAPICALLTYPE *CreateObjectFunc)(const GUID *clsid, const GUID *iid, void **outObject);

// 提取模式
namespace NArchive {
    namespace NExtract {
        namespace NAskMode {
            enum {
                kExtract = 0,
                kTest,
                kSkip
            };
        }
        namespace NOperationResult {
            enum {
                kOK = 0,
                kUnSupportedMethod,
                kDataError,
                kCRCError
            };
        }
    }
}

// 属性 ID
enum {
    kpidNoProperty = 0,
    kpidMainSubfile,
    kpidHandlerItemIndex,
    kpidPath,
    kpidName,
    kpidExtension,
    kpidIsDir,
    kpidSize,
    kpidPackSize,
    kpidAttrib,
    kpidCTime,
    kpidATime,
    kpidMTime,
    kpidSolid,
    kpidCommented,
    kpidEncrypted,
    kpidSplitBefore,
    kpidSplitAfter,
    kpidDictionarySize,
    kpidCRC,
    kpidType,
    kpidIsAnti,
    kpidMethod,
    kpidHostOS,
    kpidFileSystem,
    kpidUser,
    kpidGroup,
    kpidBlock,
    kpidComment,
    kpidPosition,
    kpidPrefix,
    kpidNumSubDirs,
    kpidNumSubFiles,
    kpidUnpackVer,
    kpidVolume,
    kpidIsVolume,
    kpidOffset,
    kpidLinks,
    kpidNumBlocks,
    kpidNumVolumes,
    kpidTimeType,
    kpidBit64,
    kpidBigEndian,
    kpidCpu,
    kpidPhySize,
    kpidHeadersSize,
    kpidChecksum,
    kpidCharacts,
    kpidVa,
    kpidId,
    kpidShortName,
    kpidCreatorApp,
    kpidSectorSize,
    kpidPosixAttrib,
    kpidSymLink,
    kpidError,
    kpidTotalSize,
    kpidFreeSpace,
    kpidClusterSize,
    kpidVolumeName,
    kpidLocalName,
    kpidProvider,
    kpidNtSecure,
    kpidIsAltStream,
    kpidIsAux,
    kpidIsDeleted,
    kpidIsTree,
    kpidSha1,
    kpidSha256,
    kpidErrorType,
    kpidNumErrors,
    kpidErrorFlags,
    kpidWarningFlags,
    kpidWarning,
    kpidNumStreams,
    kpidNumAltStreams,
    kpidAltStreamsSize,
    kpidVirtualSize,
    kpidUnpackSize,
    kpidTotalPhySize,
    kpidVolumeIndex,
    kpidSubType,
    kpidShortComment,
    kpidCodePage,
    kpidIsNotArcType,
    kpidPhySizeCantBeDetected,
    kpidZerosTailIsAllowed,
    kpidTailSize,
    kpidEmbeddedStubSize,
    kpidNtReparse,
    kpidHardLink,
    kpidINode,
    kpidStreamId,
    kpidReadOnly,
    kpidOutName,
    kpidCopyLink,
    kpidArcFileName,
    kpidIsHash,
    kpidChangeTime,
    kpidUserId,
    kpidGroupId,
    kpidDeviceMajor,
    kpidDeviceMinor,
    kpidDevMajor,
    kpidDevMinor,

    kpid_NUM_DEFINED,

    kpidUserDefined = 0x10000
};
