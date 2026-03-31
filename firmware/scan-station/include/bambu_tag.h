#pragma once

#include <Arduino.h>
#include "filament_data.h"

// ============================================================
// Filla IQ — MIFARE Classic Tag Reader
// HKDF-SHA256 key derivation for encrypted tags.
// Raw data is sent to the server for parsing (Bambu, Creality, etc.)
// ============================================================

// Derived MIFARE sector keys (16 sectors × 6 bytes each)
struct BambuKeys {
    uint8_t keyA[16][6];
    uint8_t keyB[16][6];
};

// Derive all 16 sector Key A and Key B from a 4-byte MIFARE UID.
// Uses HKDF-SHA256 with Bambu Lab's master key.
void bambuDeriveKeys(const uint8_t uid[4], BambuKeys &keys);
