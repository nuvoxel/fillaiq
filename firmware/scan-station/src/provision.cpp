#include "provision.h"
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>

Provisioner provisioner;

static DNSServer* dnsServer = nullptr;
static WebServer* webServer = nullptr;

// ── Provisioner Implementation ────────────────────────────────────────────────

void Provisioner::begin(const char* apName) {
    memset(_ssid, 0, sizeof(_ssid));
    memset(_password, 0, sizeof(_password));
    _newCreds = false;
    strncpy(_apSsid, apName, sizeof(_apSsid) - 1);

    // Disconnect STA if connected
    WiFi.disconnect(true);
    delay(100);

    // Start AP
    WiFi.mode(WIFI_AP);
    WiFi.softAP(_apSsid, PROV_AP_PASSWORD, PROV_AP_CHANNEL, 0, 4);
    delay(200);

    IPAddress apIp = WiFi.softAPIP();
    Serial.printf("[Prov] AP started: %s (pass: %s)\n", _apSsid, PROV_AP_PASSWORD);
    Serial.printf("[Prov] Portal: http://%s\n", apIp.toString().c_str());

    // DNS server — redirect all queries to AP IP (captive portal detection)
    dnsServer = new DNSServer();
    dnsServer->start(53, "*", apIp);

    // Web server
    webServer = new WebServer(PROV_PORTAL_PORT);
    webServer->on("/", HTTP_GET, [this]() { handleRoot(); });
    webServer->on("/scan", HTTP_GET, [this]() { handleScan(); });
    webServer->on("/save", HTTP_POST, [this]() { handleSave(); });
    // Apple CNA (Captive Network Assistant) detection — must return non-"Success"
    // response to trigger the captive portal sheet
    webServer->on("/hotspot-detect.html", HTTP_GET, [this]() { handleRoot(); });
    webServer->on("/library/test/success.html", HTTP_GET, [this]() { handleRoot(); });
    // Android captive portal detection
    webServer->on("/generate_204", HTTP_GET, [this]() { handleRoot(); });
    webServer->on("/gen_204", HTTP_GET, [this]() { handleRoot(); });
    // Windows NCSI
    webServer->on("/connecttest.txt", HTTP_GET, [this]() { handleRoot(); });
    webServer->on("/ncsi.txt", HTTP_GET, [this]() { handleRoot(); });
    webServer->on("/fwlink", HTTP_GET, [this]() { handleRoot(); });
    // All other requests → setup page
    webServer->onNotFound([this]() { handleRoot(); });
    webServer->begin();

    _active = true;
}

void Provisioner::stop() {
    if (!_active) return;

    if (webServer) {
        webServer->stop();
        delete webServer;
        webServer = nullptr;
    }
    if (dnsServer) {
        dnsServer->stop();
        delete dnsServer;
        dnsServer = nullptr;
    }

    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    _active = false;
    Serial.println("[Prov] Captive portal stopped");
}

void Provisioner::loop() {
    if (!_active) return;
    if (dnsServer) dnsServer->processNextRequest();
    if (webServer) webServer->handleClient();
}

bool Provisioner::isActive() { return _active; }
bool Provisioner::hasNewCredentials() { return _newCreds; }

void Provisioner::getCredentials(char* ssid, char* pass, size_t ssidLen, size_t passLen) {
    strncpy(ssid, _ssid, ssidLen - 1);
    strncpy(pass, _password, passLen - 1);
}

void Provisioner::clearNewCredentials() { _newCreds = false; }

// ── HTTP Handlers ─────────────────────────────────────────────────────────────

void Provisioner::handleRoot() {
    webServer->send(200, "text/html", buildPortalHtml());
}

void Provisioner::handleScan() {
    webServer->send(200, "application/json", scanNetworksJson());
}

void Provisioner::handleSave() {
    if (webServer->hasArg("ssid")) {
        strncpy(_ssid, webServer->arg("ssid").c_str(), sizeof(_ssid) - 1);
    }
    if (webServer->hasArg("pass")) {
        strncpy(_password, webServer->arg("pass").c_str(), sizeof(_password) - 1);
    }

    if (_ssid[0] != '\0') {
        _newCreds = true;
        Serial.printf("[Prov] Credentials received: SSID=%s\n", _ssid);
        webServer->send(200, "text/html",
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<style>body{font-family:system-ui;max-width:400px;margin:40px auto;padding:0 20px;"
            "background:#111;color:#eee;text-align:center}"
            "h2{color:#4ade80}</style></head><body>"
            "<h2>Saved!</h2><p>Connecting to WiFi...</p>"
            "<p>You can close this page and reconnect to your network.</p>"
            "</body></html>");
    } else {
        webServer->send(400, "text/html", "<html><body>Missing SSID</body></html>");
    }
}

// ── WiFi Network Scan ─────────────────────────────────────────────────────────

String Provisioner::scanNetworksJson() {
    int n = WiFi.scanNetworks(false, false, false, 300);
    String json = "[";
    for (int i = 0; i < n; i++) {
        if (i > 0) json += ",";
        json += "{\"ssid\":\"";
        // Escape quotes in SSID
        String ssid = WiFi.SSID(i);
        ssid.replace("\"", "\\\"");
        json += ssid;
        json += "\",\"rssi\":";
        json += WiFi.RSSI(i);
        json += ",\"enc\":";
        json += (WiFi.encryptionType(i) != WIFI_AUTH_OPEN) ? "true" : "false";
        json += "}";
    }
    json += "]";
    WiFi.scanDelete();
    return json;
}

// ── Captive Portal HTML ───────────────────────────────────────────────────────

String Provisioner::buildPortalHtml() {
    return R"rawliteral(<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Filla IQ Setup</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#111;color:#eee;
  max-width:420px;margin:0 auto;padding:20px}
h1{font-size:1.4em;text-align:center;margin-bottom:4px;color:#fff}
.sub{text-align:center;color:#888;font-size:.85em;margin-bottom:24px}
label{display:block;font-size:.85em;color:#aaa;margin:12px 0 4px}
input{width:100%;padding:12px;border:1px solid #333;border-radius:8px;
  background:#1a1a1a;color:#eee;font-size:1em}
button{width:100%;padding:14px;border:none;border-radius:8px;font-size:1em;
  font-weight:600;cursor:pointer;margin-top:8px}
.btn-scan{background:#333;color:#eee;margin-top:16px}
.btn-save{background:#4ade80;color:#111;margin-top:24px}
.btn-save:disabled{background:#333;color:#666}
.status{text-align:center;color:#888;font-size:.85em;margin-top:8px;min-height:20px}
.net-list{max-height:200px;overflow-y:auto;margin-top:8px}
.net{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
  border:1px solid #333;border-radius:8px;margin-bottom:6px;cursor:pointer;
  background:#1a1a1a;transition:background .15s}
.net:active{background:#333}
.net-name{font-weight:500}
.net-rssi{font-size:.8em;color:#888}
.lock::after{content:" \U0001f512";font-size:.7em}
</style>
</head><body>
<h1>Filla IQ</h1>
<p class="sub">WiFi Setup</p>

<button class="btn-scan" onclick="scanNetworks()">Scan for Networks</button>
<div class="status" id="scanStatus"></div>
<div class="net-list" id="netList"></div>

<form id="setupForm" action="/save" method="POST">
<label for="ssid">WiFi Network</label>
<input type="text" id="ssid" name="ssid" placeholder="Select from scan or type manually" required>

<label for="pass">Password</label>
<input type="password" id="pass" name="pass" placeholder="WiFi password">

<button type="submit" class="btn-save">Connect</button>
</form>

<script>
function scanNetworks(){
  var s=document.getElementById('scanStatus');
  s.textContent='Scanning...';
  fetch('/scan').then(r=>r.json()).then(function(nets){
    s.textContent=nets.length+' networks found';
    var list=document.getElementById('netList');
    list.innerHTML='';
    nets.sort(function(a,b){return b.rssi-a.rssi});
    nets.forEach(function(n){
      var d=document.createElement('div');
      d.className='net';
      var sig=n.rssi>-50?'\u25B0\u25B0\u25B0\u25B0':n.rssi>-65?'\u25B0\u25B0\u25B0\u25B1':n.rssi>-80?'\u25B0\u25B0\u25B1\u25B1':'\u25B0\u25B1\u25B1\u25B1';
      d.innerHTML='<span class="net-name'+(n.enc?' lock':'')+'">'
        +n.ssid+'</span><span class="net-rssi">'+sig+' '+n.rssi+'</span>';
      d.onclick=function(){
        document.getElementById('ssid').value=n.ssid;
        document.getElementById('pass').focus();
      };
      list.appendChild(d);
    });
  }).catch(function(){s.textContent='Scan failed';});
}
scanNetworks();
</script>
</body></html>)rawliteral";
}
