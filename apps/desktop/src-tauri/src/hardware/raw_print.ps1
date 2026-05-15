param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$BytesPath
)

$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printer, byte[] bytes) {
        IntPtr h = IntPtr.Zero;
        int written = 0;
        bool ok = false;
        var di = new DOCINFOA { pDocName = "POS Cash Drawer", pDataType = "RAW" };
        if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
        try {
            if (StartDocPrinter(h, 1, di)) {
                try {
                    if (StartPagePrinter(h)) {
                        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
                        try {
                            Marshal.Copy(bytes, 0, p, bytes.Length);
                            ok = WritePrinter(h, p, bytes.Length, out written);
                        } finally {
                            Marshal.FreeCoTaskMem(p);
                        }
                        EndPagePrinter(h);
                    }
                } finally {
                    EndDocPrinter(h);
                }
            }
        } finally {
            ClosePrinter(h);
        }
        return ok;
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($BytesPath)
$result = [RawPrinter]::SendBytesToPrinter($PrinterName, $bytes)
if (-not $result) {
    Write-Error "WritePrinter failed for '$PrinterName'"
    exit 1
}
