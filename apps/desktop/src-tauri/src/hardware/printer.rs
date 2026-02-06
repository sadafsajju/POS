// Thermal Printer Integration (ESC/POS)

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub port: String,
    pub printer_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceiptData {
    pub store_name: String,
    pub store_address: Option<String>,
    pub order_number: String,
    pub items: Vec<ReceiptItem>,
    pub subtotal: f64,
    pub tax: f64,
    pub discount: f64,
    pub total: f64,
    pub payment_method: String,
    pub footer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceiptItem {
    pub name: String,
    pub quantity: i32,
    pub price: f64,
    pub modifiers: Option<Vec<String>>,
}

/// KOT (Kitchen Order Ticket) Data
#[derive(Debug, Serialize, Deserialize)]
pub struct KOTData {
    pub order_number: String,
    pub table_number: Option<String>,
    pub customer_name: Option<String>,
    pub order_type: String,
    pub items: Vec<KOTItem>,
    pub notes: Option<String>,
    pub is_new_items: bool, // true if adding items to existing order
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KOTItem {
    pub name: String,
    pub quantity: i32,
    pub special_instructions: Option<String>,
}

/// Get list of available printers
#[tauri::command]
pub async fn get_printers() -> Result<Vec<PrinterInfo>, String> {
    // In a real implementation, this would enumerate USB/Serial/Network printers
    // For now, return a placeholder

    let printers = vec![
        PrinterInfo {
            name: "Default Thermal Printer".to_string(),
            port: "USB001".to_string(),
            printer_type: "ESC/POS".to_string(),
        },
    ];

    Ok(printers)
}

/// Print a receipt
#[tauri::command]
pub async fn print_receipt(receipt: ReceiptData, printer_port: Option<String>) -> Result<bool, String> {
    let _port = printer_port.unwrap_or_else(|| "USB001".to_string());

    // Build ESC/POS commands
    let commands = build_receipt_commands(&receipt);

    // In a real implementation, send commands to the printer
    // For now, log the receipt data
    println!("Printing receipt: {:?}", commands);

    Ok(true)
}

/// Print a KOT (Kitchen Order Ticket)
#[tauri::command]
pub async fn print_kot(kot: KOTData, printer_port: Option<String>) -> Result<bool, String> {
    let _port = printer_port.unwrap_or_else(|| "USB001".to_string());

    // Build ESC/POS commands for KOT
    let commands = build_kot_commands(&kot);

    // In a real implementation, send commands to the kitchen printer
    // For now, log the KOT data
    println!("Printing KOT: {:?}", commands);

    Ok(true)
}

fn build_receipt_commands(receipt: &ReceiptData) -> Vec<u8> {
    let mut commands: Vec<u8> = Vec::new();

    // ESC/POS Initialize
    commands.extend_from_slice(&[0x1B, 0x40]); // ESC @

    // Center align
    commands.extend_from_slice(&[0x1B, 0x61, 0x01]); // ESC a 1

    // Store name (double height)
    commands.extend_from_slice(&[0x1B, 0x21, 0x10]); // ESC ! 16 (double height)
    commands.extend_from_slice(receipt.store_name.as_bytes());
    commands.push(0x0A); // Line feed

    // Normal size
    commands.extend_from_slice(&[0x1B, 0x21, 0x00]); // ESC ! 0

    // Store address
    if let Some(addr) = &receipt.store_address {
        commands.extend_from_slice(addr.as_bytes());
        commands.push(0x0A);
    }

    // Separator
    commands.extend_from_slice(b"--------------------------------\n");

    // Left align
    commands.extend_from_slice(&[0x1B, 0x61, 0x00]); // ESC a 0

    // Order number
    commands.extend_from_slice(format!("Order: {}\n", receipt.order_number).as_bytes());
    commands.extend_from_slice(b"--------------------------------\n");

    // Items
    for item in &receipt.items {
        let item_line = format!(
            "{} x {} ${:.2}\n",
            item.quantity, item.name, item.price
        );
        commands.extend_from_slice(item_line.as_bytes());

        if let Some(mods) = &item.modifiers {
            for modifier in mods {
                commands.extend_from_slice(format!("  + {}\n", modifier).as_bytes());
            }
        }
    }

    // Separator
    commands.extend_from_slice(b"--------------------------------\n");

    // Totals
    commands.extend_from_slice(format!("Subtotal:         ${:.2}\n", receipt.subtotal).as_bytes());
    commands.extend_from_slice(format!("Tax:              ${:.2}\n", receipt.tax).as_bytes());

    if receipt.discount > 0.0 {
        commands.extend_from_slice(format!("Discount:        -${:.2}\n", receipt.discount).as_bytes());
    }

    // Bold for total
    commands.extend_from_slice(&[0x1B, 0x45, 0x01]); // ESC E 1 (bold on)
    commands.extend_from_slice(format!("TOTAL:            ${:.2}\n", receipt.total).as_bytes());
    commands.extend_from_slice(&[0x1B, 0x45, 0x00]); // ESC E 0 (bold off)

    // Payment method
    commands.extend_from_slice(format!("Paid by: {}\n", receipt.payment_method).as_bytes());

    // Footer
    commands.extend_from_slice(b"--------------------------------\n");
    commands.extend_from_slice(&[0x1B, 0x61, 0x01]); // Center align

    if let Some(footer) = &receipt.footer {
        commands.extend_from_slice(footer.as_bytes());
        commands.push(0x0A);
    }

    // Cut paper
    commands.extend_from_slice(&[0x1D, 0x56, 0x00]); // GS V 0 (full cut)

    commands
}

fn build_kot_commands(kot: &KOTData) -> Vec<u8> {
    let mut commands: Vec<u8> = Vec::new();

    // ESC/POS Initialize
    commands.extend_from_slice(&[0x1B, 0x40]); // ESC @

    // Center align
    commands.extend_from_slice(&[0x1B, 0x61, 0x01]); // ESC a 1

    // KOT Header (double height + double width for emphasis)
    commands.extend_from_slice(&[0x1B, 0x21, 0x30]); // ESC ! 48 (double height + double width)

    if kot.is_new_items {
        commands.extend_from_slice(b"** NEW ITEMS **");
    } else {
        commands.extend_from_slice(b"KITCHEN ORDER");
    }
    commands.push(0x0A); // Line feed

    // Normal size
    commands.extend_from_slice(&[0x1B, 0x21, 0x00]); // ESC ! 0

    // Separator
    commands.extend_from_slice(b"================================\n");

    // Left align for details
    commands.extend_from_slice(&[0x1B, 0x61, 0x00]); // ESC a 0

    // Order number (bold)
    commands.extend_from_slice(&[0x1B, 0x45, 0x01]); // ESC E 1 (bold on)
    commands.extend_from_slice(format!("Order: {}\n", kot.order_number).as_bytes());
    commands.extend_from_slice(&[0x1B, 0x45, 0x00]); // ESC E 0 (bold off)

    // Table number (if dine-in)
    if let Some(table) = &kot.table_number {
        commands.extend_from_slice(&[0x1B, 0x21, 0x10]); // Double height
        commands.extend_from_slice(format!("TABLE: {}\n", table).as_bytes());
        commands.extend_from_slice(&[0x1B, 0x21, 0x00]); // Normal size
    }

    // Order type
    let order_type_display = match kot.order_type.as_str() {
        "dine_in" => "DINE-IN",
        "takeout" => "TAKEOUT",
        "delivery" => "DELIVERY",
        _ => &kot.order_type,
    };
    commands.extend_from_slice(format!("Type: {}\n", order_type_display).as_bytes());

    // Customer name (if provided)
    if let Some(name) = &kot.customer_name {
        commands.extend_from_slice(format!("Customer: {}\n", name).as_bytes());
    }

    // Timestamp
    commands.extend_from_slice(format!("Time: {}\n", chrono::Local::now().format("%H:%M:%S")).as_bytes());

    // Separator
    commands.extend_from_slice(b"================================\n");

    // Items header
    commands.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold on
    commands.extend_from_slice(b"ITEMS:\n");
    commands.extend_from_slice(&[0x1B, 0x45, 0x00]); // Bold off
    commands.extend_from_slice(b"--------------------------------\n");

    // Items (larger font for kitchen readability)
    for item in &kot.items {
        // Quantity x Item name (double height for visibility)
        commands.extend_from_slice(&[0x1B, 0x21, 0x10]); // Double height
        commands.extend_from_slice(format!("{}x {}\n", item.quantity, item.name).as_bytes());
        commands.extend_from_slice(&[0x1B, 0x21, 0x00]); // Normal size

        // Special instructions (if any)
        if let Some(instructions) = &item.special_instructions {
            if !instructions.is_empty() {
                commands.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold on
                commands.extend_from_slice(format!("   >> {}\n", instructions).as_bytes());
                commands.extend_from_slice(&[0x1B, 0x45, 0x00]); // Bold off
            }
        }
    }

    // Order notes
    if let Some(notes) = &kot.notes {
        if !notes.is_empty() {
            commands.extend_from_slice(b"--------------------------------\n");
            commands.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold on
            commands.extend_from_slice(format!("NOTES: {}\n", notes).as_bytes());
            commands.extend_from_slice(&[0x1B, 0x45, 0x00]); // Bold off
        }
    }

    // Footer separator
    commands.extend_from_slice(b"================================\n");

    // Feed extra lines for tear-off
    commands.extend_from_slice(&[0x0A, 0x0A, 0x0A]);

    // Cut paper
    commands.extend_from_slice(&[0x1D, 0x56, 0x00]); // GS V 0 (full cut)

    commands
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_receipt() {
        let receipt = ReceiptData {
            store_name: "Test Store".to_string(),
            store_address: Some("123 Main St".to_string()),
            order_number: "ORD-001".to_string(),
            items: vec![
                ReceiptItem {
                    name: "Burger".to_string(),
                    quantity: 2,
                    price: 9.99,
                    modifiers: Some(vec!["Extra Cheese".to_string()]),
                },
            ],
            subtotal: 19.98,
            tax: 1.80,
            discount: 0.0,
            total: 21.78,
            payment_method: "Cash".to_string(),
            footer: Some("Thank you!".to_string()),
        };

        let commands = build_receipt_commands(&receipt);
        assert!(!commands.is_empty());
    }
}
