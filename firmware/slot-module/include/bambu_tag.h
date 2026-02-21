#pragma once

#include <Arduino.h>
#include "filament_data.h"

// ============================================================
// Filla IQ — Bambu Lab MIFARE Classic 1K Tag Reader
// HKDF-SHA256 key derivation + sector auth + data parsing
// ============================================================

class Adafruit_PN532;

// Derived MIFARE sector keys (16 sectors × 6 bytes each)
struct BambuKeys {
    uint8_t keyA[16][6];
    uint8_t keyB[16][6];
};

// Derive all 16 sector Key A and Key B from a 4-byte MIFARE UID.
// Uses HKDF-SHA256 with Bambu Lab's master key.
void bambuDeriveKeys(const uint8_t uid[4], BambuKeys &keys);

// Authenticate sectors, read data blocks, and parse filament info.
// The reader must already have the tag selected (readPassiveTargetID succeeded).
// Returns true if at least the core fields were read successfully.
bool bambuReadTag(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                  FilamentInfo &out);

// Print parsed filament info to serial (for diagnostics)
void bambuPrintInfo(const FilamentInfo &info);
