// Cash drawer kick — sends ESC/POS pulse bytes to a printer in RAW mode so
// the drawer (wired to the printer's RJ11 port) pops open. Works for the
// majority of POS setups where the drawer hangs off a thermal receipt
// printer rather than connecting to the host directly.
//
// macOS / Linux: writes bytes to a temp file and calls `lp -o raw`.
// Windows:       writes bytes + the bundled raw_print.ps1 helper to temp,
//                then calls the helper which uses winspool.drv WritePrinter
//                to send the bytes through with the RAW datatype.

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

// ESC p 0 25 250  — Pulse drawer-1 pin (Epson/Star compatible), 25ms on,
// 250ms off. If the drawer is wired to pin 5 we send ESC p 1 25 250.
const KICK_PIN_2: [u8; 5] = [0x1B, 0x70, 0x00, 0x19, 0xFA];
const KICK_PIN_5: [u8; 5] = [0x1B, 0x70, 0x01, 0x19, 0xFA];

#[cfg(target_os = "windows")]
const RAW_PRINT_PS1: &str = include_str!("raw_print.ps1");

fn write_temp_bytes(bytes: &[u8]) -> Result<PathBuf, String> {
    let mut path = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.push(format!("pos-cash-kick-{}.bin", stamp));
    let mut f = fs::File::create(&path).map_err(|e| format!("temp file create failed: {e}"))?;
    f.write_all(bytes).map_err(|e| format!("temp file write failed: {e}"))?;
    f.flush().ok();
    Ok(path)
}

#[cfg(target_os = "windows")]
fn send_raw(printer_name: &str, bytes_path: &PathBuf) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    if printer_name.is_empty() {
        return Err("No printer configured for cash drawer".into());
    }
    let mut ps_path = std::env::temp_dir();
    ps_path.push("pos-raw-print.ps1");
    fs::write(&ps_path, RAW_PRINT_PS1).map_err(|e| format!("ps1 write failed: {e}"))?;

    // CREATE_NO_WINDOW (0x08000000) keeps PowerShell headless so the user
    // doesn't see a console flash on every drawer kick.
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
    // `lp -o raw` tells CUPS not to filter or rasterize — bytes go straight
    // to the printer, which is exactly what we need for ESC/POS commands.
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

/// Kick the cash drawer connected to a thermal printer.
///
/// `printer_name` is the OS print-queue name (CUPS name on macOS/Linux,
/// the printer name as shown in Windows Printers & Scanners). If empty on
/// macOS/Linux, the system default is used. On Windows it must be provided.
///
/// `pin` is the drawer pin to pulse — 2 (default, Epson "Drawer 1") or 5.
#[tauri::command]
pub async fn open_cash_drawer(
    printer_name: Option<String>,
    pin: Option<u8>,
) -> Result<bool, String> {
    let bytes = if matches!(pin, Some(5)) { KICK_PIN_5 } else { KICK_PIN_2 };
    let path = write_temp_bytes(&bytes)?;
    let name = printer_name.unwrap_or_default();
    let res = send_raw(&name, &path);
    let _ = fs::remove_file(&path);
    res.map(|_| true)
}

/// List system print queues so the user can pick which one the drawer is
/// plugged into. Returns a flat list of queue names.
#[tauri::command]
pub async fn list_system_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("powershell.exe");
        cmd.creation_flags(0x08000000).args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Printer | Select-Object -ExpandProperty Name",
        ]);
        let out = cmd.output().map_err(|e| format!("Get-Printer failed: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).to_string());
        }
        return Ok(String::from_utf8_lossy(&out.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let out = Command::new("lpstat")
            .arg("-e")
            .output()
            .map_err(|e| format!("lpstat not found (is CUPS installed?): {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect())
    }
}
