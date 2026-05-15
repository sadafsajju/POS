// Thermal printer — sends arbitrary ESC/POS byte streams to an OS print
// queue in RAW mode. The frontend builds the receipt or KOT bytes (it owns
// the receipt format — VAT, allergens, tipping, etc.) and hands them off
// here; this module just shovels them to the printer's spooler.
//
// macOS / Linux: `lp -o raw -d <queue>` — CUPS skips rasterization and
//                 pipes the bytes straight to the device.
// Windows:       PowerShell helper (the same raw_print.ps1 used by the
//                cash drawer) which calls winspool.drv WritePrinter with
//                pDataType = "RAW".

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
const RAW_PRINT_PS1: &str = include_str!("raw_print.ps1");

fn write_temp_bytes(bytes: &[u8], hint: &str) -> Result<PathBuf, String> {
    let mut path = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.push(format!("pos-{hint}-{stamp}.bin"));
    let mut f = fs::File::create(&path).map_err(|e| format!("temp file create failed: {e}"))?;
    f.write_all(bytes).map_err(|e| format!("temp file write failed: {e}"))?;
    f.flush().ok();
    Ok(path)
}

#[cfg(target_os = "windows")]
fn send_raw(printer_name: &str, bytes_path: &PathBuf) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    if printer_name.is_empty() {
        return Err("No printer selected".into());
    }
    let mut ps_path = std::env::temp_dir();
    ps_path.push("pos-raw-print.ps1");
    fs::write(&ps_path, RAW_PRINT_PS1).map_err(|e| format!("ps1 write failed: {e}"))?;

    // CREATE_NO_WINDOW (0x08000000) keeps PowerShell headless so the user
    // doesn't see a console flash on every receipt / KOT / drawer kick.
    let mut cmd = Command::new("powershell.exe");
    cmd.creation_flags(0x08000000)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&ps_path)
        .arg("-PrinterName")
        .arg(printer_name)
        .arg("-BytesPath")
        .arg(bytes_path);
    let out = cmd
        .output()
        .map_err(|e| format!("powershell spawn failed: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "raw print failed for '{printer_name}': {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn send_raw(printer_name: &str, bytes_path: &PathBuf) -> Result<(), String> {
    let mut cmd = Command::new("lp");
    cmd.arg("-o").arg("raw");
    if !printer_name.is_empty() {
        cmd.arg("-d").arg(printer_name);
    }
    cmd.arg(bytes_path);
    let out = cmd
        .output()
        .map_err(|e| format!("lp spawn failed (is CUPS installed?): {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "lp failed (printer='{printer_name}'): {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(())
}

/// Send a raw byte stream to the named OS print queue. The frontend uses
/// this for ESC/POS receipts and KOTs — it builds the bytes itself so we
/// don't end up mirroring the receipt-template logic in Rust.
///
/// `printer_name` is the CUPS queue name on macOS/Linux or the printer name
/// as it appears in Windows Printers & Scanners. Empty string falls back to
/// the system default on macOS/Linux; on Windows it errors.
#[tauri::command]
pub async fn print_raw_bytes(printer_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    if bytes.is_empty() {
        return Err("Nothing to print (empty byte stream)".into());
    }
    let path = write_temp_bytes(&bytes, "receipt")?;
    let res = send_raw(&printer_name, &path);
    let _ = fs::remove_file(&path);
    res.map(|_| true)
}

/// Legacy aliases retained so existing invoke_handler entries still resolve
/// while the frontend transitions. Both delegate to `print_raw_bytes`.
#[tauri::command]
pub async fn print_receipt(printer_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    print_raw_bytes(printer_name, bytes).await
}

#[tauri::command]
pub async fn print_kot(printer_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    print_raw_bytes(printer_name, bytes).await
}

/// Thin alias so the frontend doesn't depend on the cash_drawer module name.
#[tauri::command]
pub async fn list_thermal_printers() -> Result<Vec<String>, String> {
    super::cash_drawer::list_system_printers().await
}

/// Backwards-compat: the older invoke handler exposed `get_printers` and
/// some calling code may still reference it. Keep it pointing at the same
/// real list so it stops returning the placeholder.
#[tauri::command]
pub async fn get_printers() -> Result<Vec<String>, String> {
    list_thermal_printers().await
}
