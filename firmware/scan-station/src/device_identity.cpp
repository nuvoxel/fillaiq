#include "device_identity.h"
#include <esp_hmac.h>
#include <esp_efuse.h>
#include <esp_random.h>
#include <WiFi.h>

DeviceIdentity deviceIdentity;

// Use KEY5 (EFUSE_BLK9) — least likely to conflict with
// Flash Encryption (which prefers KEY0) or Secure Boot.
#define HMAC_KEY_BLOCK   EFUSE_BLK_KEY5
#define HMAC_KEY_ID      HMAC_KEY5

static void toHex(const uint8_t* data, size_t len, char* out) {
    for (size_t i = 0; i < len; i++) {
        snprintf(out + i * 2, 3, "%02x", data[i]);
    }
}

bool DeviceIdentity::begin() {
    // Build hardware ID from eFuse MAC (always available)
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);
    toHex(mac, 6, _hwIdHex);

    if (_hasKey()) {
        Serial.printf("  Identity: %s (HMAC provisioned)\n", _hwIdHex);
        _provisioned = true;
    } else {
        Serial.printf("  Identity: %s (no HMAC key — burning...)\n", _hwIdHex);
        if (_burnKey()) {
            _provisioned = true;
            Serial.println("  Identity: eFuse HMAC key burned OK");
        } else {
            Serial.println("  Identity: eFuse burn FAILED — using MAC only");
            _provisioned = false;
        }
    }

    if (_provisioned) {
        _computeSecret();
    }

    return _provisioned;
}

bool DeviceIdentity::_hasKey() {
    // Check if our key block has HMAC_UP purpose set
    esp_efuse_purpose_t purpose = esp_efuse_get_key_purpose(HMAC_KEY_BLOCK);
    return purpose == ESP_EFUSE_KEY_PURPOSE_HMAC_UP;
}

bool DeviceIdentity::_burnKey() {
    // Verify block is unused
    if (!esp_efuse_key_block_unused(HMAC_KEY_BLOCK)) {
        Serial.println("  Identity: KEY5 already in use");
        return false;
    }

    // Generate 256-bit random key using hardware RNG
    uint8_t key[32];
    esp_fill_random(key, sizeof(key));

    // Burn to eFuse with HMAC_UP purpose (auto-sets read protection)
    esp_err_t err = esp_efuse_write_key(
        HMAC_KEY_BLOCK,
        ESP_EFUSE_KEY_PURPOSE_HMAC_UP,
        key, sizeof(key)
    );

    // Clear key from RAM immediately
    memset(key, 0, sizeof(key));

    if (err != ESP_OK) {
        Serial.printf("  Identity: esp_efuse_write_key failed: %d\n", err);
        return false;
    }

    return true;
}

bool DeviceIdentity::_computeSecret() {
    // deviceSecret = HMAC(efuseKey, efuseMac)
    // This is stable: same key + same MAC = same result every time
    uint8_t mac[6];
    esp_efuse_mac_get_default(mac);

    uint8_t hmac[32];
    esp_err_t err = esp_hmac_calculate(HMAC_KEY_ID, mac, sizeof(mac), hmac);

    if (err != ESP_OK) {
        Serial.printf("  Identity: HMAC compute failed: %d\n", err);
        return false;
    }

    toHex(hmac, 32, _secretHex);
    return true;
}

bool DeviceIdentity::sign(const uint8_t* data, size_t len, uint8_t* out) {
    if (!_provisioned) return false;
    esp_err_t err = esp_hmac_calculate(HMAC_KEY_ID, data, len, out);
    return err == ESP_OK;
}

void DeviceIdentity::printStatus() {
    Serial.println("=== Device Identity ===");
    Serial.printf("  Hardware ID: %s\n", _hwIdHex);
    Serial.printf("  HMAC key:    %s (KEY5/BLK9)\n", _provisioned ? "provisioned" : "NOT provisioned");
    if (_provisioned) {
        Serial.printf("  Secret:      %.16s...\n", _secretHex);
    }
}
