// Barcode Scanner Integration

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

static SCANNER_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub barcode: String,
    pub format: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub port: Option<String>,
    pub baud_rate: Option<u32>,
    pub auto_enter: bool,
}

/// Start listening for barcode scans
#[tauri::command]
pub async fn start_scanner(config: Option<ScannerConfig>) -> Result<bool, String> {
    if SCANNER_ACTIVE.load(Ordering::SeqCst) {
        return Err("Scanner already active".to_string());
    }

    let _config = config.unwrap_or(ScannerConfig {
        port: None,
        baud_rate: Some(9600),
        auto_enter: true,
    });

    SCANNER_ACTIVE.store(true, Ordering::SeqCst);

    // In a real implementation, this would:
    // 1. Open a serial port connection to the scanner
    // 2. Start a background thread to listen for scans
    // 3. Emit events to the frontend when a barcode is scanned

    println!("Scanner started");
    Ok(true)
}

/// Stop listening for barcode scans
#[tauri::command]
pub async fn stop_scanner() -> Result<bool, String> {
    if !SCANNER_ACTIVE.load(Ordering::SeqCst) {
        return Err("Scanner not active".to_string());
    }

    SCANNER_ACTIVE.store(false, Ordering::SeqCst);

    println!("Scanner stopped");
    Ok(true)
}

/// Parse a barcode and determine its format
pub fn parse_barcode(barcode: &str) -> ScanResult {
    let format = detect_barcode_format(barcode);

    ScanResult {
        barcode: barcode.to_string(),
        format,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
    }
}

fn detect_barcode_format(barcode: &str) -> String {
    let len = barcode.len();
    let is_numeric = barcode.chars().all(|c| c.is_numeric());

    if is_numeric {
        match len {
            8 => "EAN-8".to_string(),
            12 => "UPC-A".to_string(),
            13 => "EAN-13".to_string(),
            14 => "ITF-14".to_string(),
            _ => "NUMERIC".to_string(),
        }
    } else if barcode.starts_with(|c: char| c.is_ascii_uppercase()) && len <= 10 {
        "CODE39".to_string()
    } else if len > 0 && len <= 48 {
        "CODE128".to_string()
    } else {
        "UNKNOWN".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_barcode_format_detection() {
        assert_eq!(detect_barcode_format("12345678"), "EAN-8");
        assert_eq!(detect_barcode_format("123456789012"), "UPC-A");
        assert_eq!(detect_barcode_format("1234567890123"), "EAN-13");
        assert_eq!(detect_barcode_format("ABC123"), "CODE39");
    }
}
