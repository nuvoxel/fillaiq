#pragma once

#include <Arduino.h>
#include "filament_data.h"

// ============================================================
// Filla IQ — MIFARE Classic Tag Reader
// HKDF-SHA256 key derivation + sector auth for encrypted tags.
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

// --- Generic tag reading (PN532 only — PN5180 handles reading in nfc.cpp) ---
#ifndef BOARD_SCAN_TOUCH

class Adafruit_PN532;

// Read a range of sectors into TagData. Tag must be selected, keys pre-derived.
void readMifareClassicSectors(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                              const BambuKeys &bambuKeys, uint8_t startSector, uint8_t count,
                              TagData &out);

// Read all sectors at once (convenience, blocks for ~10s — prefer incremental).
void readMifareClassicRaw(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                          TagData &out);

// Read all pages of an NTAG/Ultralight tag into TagData.
void readNtagRaw(Adafruit_PN532 &reader, TagData &out);

#endif // !BOARD_SCAN_TOUCH
