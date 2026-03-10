#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — WiFi AP + Captive Portal Provisioning
//
// Station starts a WiFi AP, displays QR code on OLED for easy
// phone connection. Captive portal serves setup page where
// user enters WiFi credentials and API config.
// ============================================================

// AP defaults
#define PROV_AP_PASSWORD    "fillaiq1"
#define PROV_AP_CHANNEL     1
#define PROV_PORTAL_PORT    80

class Provisioner {
public:
    void begin(const char* apName);
    void stop();
    void loop();  // Must be called from main loop while active
    bool isActive();

    // Check if new credentials were received via captive portal
    bool hasNewCredentials();
    void getCredentials(char* ssid, char* pass, char* apiUrl, char* apiKey,
                        size_t ssidLen, size_t passLen, size_t urlLen, size_t keyLen);
    void clearNewCredentials();

    // Get AP SSID for QR code generation
    const char* getApSsid() const { return _apSsid; }

private:
    bool _active = false;
    bool _newCreds = false;
    char _apSsid[32] = {0};
    char _ssid[64] = {0};
    char _password[64] = {0};
    char _apiUrl[256] = {0};
    char _apiKey[128] = {0};

    void handleRoot();
    void handleScan();
    void handleSave();
    void handleCaptive();
    String buildPortalHtml();
    String scanNetworksJson();
};

extern Provisioner provisioner;
