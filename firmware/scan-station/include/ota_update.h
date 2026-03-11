#pragma once

#include <Arduino.h>
#include "scan_config.h"

void otaBegin();       // Call in setup() after WiFi+API init
void otaLoop();        // Call in loop() — handles periodic check
void otaCheckNow();    // Force an immediate check (e.g., serial command)
bool otaInProgress();  // True during download
