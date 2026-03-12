#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — Hardware-Rooted Device Identity (ESP32-S3 HMAC)
//
// Uses the ESP32-S3 HMAC peripheral with a 256-bit key burned
// into eFuse. The key can never be read back by software or
// JTAG — only used to compute HMAC-SHA256 via hardware.
//
// On first boot, a random key is generated and burned. The
// device secret is derived as HMAC(efuseKey, efuseMac) and
// is stable across reboots, reflash, and NVS wipe.
//
// Moving a device to a new account is server-side only — the
// device identity never changes.
// ============================================================

class DeviceIdentity {
public:
    // Initialize: check if eFuse key exists, burn one if not.
    // Returns true if identity is available.
    bool begin();

    // Whether the HMAC key has been provisioned
    bool isProvisioned() const { return _provisioned; }

    // 64-char hex string: HMAC(efuseKey, efuseMac)
    // Stable, unique, hardware-rooted credential.
    const char* getDeviceSecret() const { return _secretHex; }

    // 12-char hex string: full 6-byte eFuse MAC
    const char* getHardwareId() const { return _hwIdHex; }

    // Sign arbitrary data with the eFuse HMAC key.
    // Returns 32-byte HMAC-SHA256 in `out`.
    bool sign(const uint8_t* data, size_t len, uint8_t* out);

    void printStatus();

private:
    bool _provisioned = false;
    char _secretHex[65] = {0};  // 32 bytes * 2 hex chars + null
    char _hwIdHex[13] = {0};   // 6 bytes * 2 hex chars + null

    bool _hasKey();
    bool _burnKey();
    bool _computeSecret();
};

extern DeviceIdentity deviceIdentity;
