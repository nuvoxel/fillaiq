#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — USB Host Printer Driver
// Uses ESP-IDF USB Host Library to communicate with Phomemo
// label printers over USB (same ESC/POS protocol as BLE).
// ============================================================

#include "usb/usb_host.h"

void usbPrinterBegin();
void usbPrinterLoop();         // Must be called regularly to process USB events
bool usbPrinterReady();
bool usbPrinterSend(const uint8_t* data, size_t len, uint32_t timeoutMs = 5000);
void usbPrinterDisconnect();

// Device info from USB descriptors
uint16_t usbPrinterVid();
uint16_t usbPrinterPid();
const char* usbPrinterManufacturer();
const char* usbPrinterProduct();
const char* usbPrinterSerial();
