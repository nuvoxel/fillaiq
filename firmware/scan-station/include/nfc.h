#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "filament_data.h"

// ============================================================
// Filla IQ — Scan Station Single PN532 NFC Reader
// Adapted from slot-module dual-reader for single reader.
// Called from main loop (no separate task needed).
// ============================================================

#define NFC_UID_MAX_LEN  7

struct TagState {
    uint8_t  uid[NFC_UID_MAX_LEN];
    uint8_t  uid_len;
    bool     present;
    bool     was_present;
    unsigned long last_seen;

    void clear() {
        memset(uid, 0, sizeof(uid));
        uid_len = 0;
        present = false;
        was_present = false;
        last_seen = 0;
    }
};

class NfcScanner {
public:
    void begin();
    void poll();    // Call from loop

    bool isTagPresent();
    bool isConnected();
    void getUid(uint8_t* buf, uint8_t* len);
    String getUidString();

    // Raw tag data (for web service)
    const TagData& getTagData();
    bool hasTagData();

    // Filament data (populated from local Bambu parsing)
    const FilamentInfo& getFilamentInfo();
    bool hasFilamentInfo();

    void printStatus();

private:
    void _startRead();
    void _continueRead();
    void _finishRead();

    TagData      _tagData;
    FilamentInfo _filament;
    TagState     _tag;
    bool         _connected;

    // Incremental read state
    static const uint8_t SECTORS_PER_POLL = 2;
    static const uint8_t PAGES_PER_POLL = 30;
    uint8_t _nextSector;   // 0xFF = not reading
    uint8_t _nextPage;     // 0xFF = not reading
};

extern NfcScanner nfcScanner;

void initNfc();
void pollNfc();
