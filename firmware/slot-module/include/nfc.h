#pragma once

#include <Arduino.h>
#include "config.h"
#include "filament_data.h"

// ============================================================
// Filla IQ — Dual PN532 NFC Reader Driver
// Elechouse NFC Module V3 (PN532) x2, SPI mode, shared bus
// Round-robin polling from Core 0 main loop
// ============================================================

#define NFC_UID_MAX_LEN  7

struct TagState {
    uint8_t  uid[NFC_UID_MAX_LEN];
    uint8_t  uid_len;
    bool     present;
    bool     was_present;       // Previous state (for edge detection)
    unsigned long last_seen;

    void clear() {
        memset(uid, 0, sizeof(uid));
        uid_len = 0;
        present = false;
        was_present = false;
        last_seen = 0;
    }
};

class NfcReader {
public:
    void begin();
    void poll();    // Call from loop — polls one reader per call

    bool isTagPresent(uint8_t bay);
    bool isConnected(uint8_t bay);
    void getUid(uint8_t bay, uint8_t* buf, uint8_t* len);
    String getUidString(uint8_t bay);

    void printStatus();

    // Filament data (populated when tag is read)
    bool readBambuTag(uint8_t bay, FilamentInfo &info);
    const FilamentInfo& getFilamentInfo(uint8_t bay);
    bool hasFilamentInfo(uint8_t bay);

private:
    FilamentInfo _filament[NFC_NUM_READERS];
    TagState _tags[NFC_NUM_READERS];
    bool     _connected[NFC_NUM_READERS];
    uint8_t  _poll_idx;         // Which reader to poll next
};

extern NfcReader nfcReader;

// Free function API (matches project pattern)
void initNfc();
void pollNfc();
