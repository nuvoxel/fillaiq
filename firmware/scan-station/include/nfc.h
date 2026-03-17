#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "filament_data.h"

// ============================================================
// Filla IQ — FillaScan NFC Reader
// Touch board: PN5180 on dedicated SPI bus (HSPI)
//   - ISO 14443A (MIFARE Classic, NTAG) + ISO 15693 (ICODE SLIX)
// DevKitC: PN532 on shared SPI bus
//   - ISO 14443A only
// ============================================================

#define NFC_UID_MAX_LEN  8  // ISO 15693 UIDs are 8 bytes

enum NfcState : uint8_t {
    NFC_IDLE,          // Not initialized or error
    NFC_LISTENING,     // Polling for tags
    NFC_READING,       // Tag found, doing incremental sector/page reads
    NFC_PRESENT,       // Read complete, monitoring for removal
};

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

    // Raw tag data (sent to web service for parsing)
    const TagData& getTagData();
    bool hasTagData();

    void printStatus();

private:
    void _startRead();
    void _continueRead();
    void _finishRead();

    TagData      _tagData;
    TagState     _tag;
    bool         _connected;
    NfcState     _state = NFC_IDLE;
    unsigned long _listenStartTime = 0;
    unsigned long _presenceCheckTime = 0;

    // Incremental read state
    static const uint8_t SECTORS_PER_POLL = 2;
    static const uint8_t PAGES_PER_POLL = 30;
    uint8_t _nextSector;   // 0xFF = not reading
    uint8_t _nextPage;     // 0xFF = not reading
};

extern NfcScanner nfcScanner;

void initNfc();
void pollNfc();
