// NAME: PN5180ISO14443.cpp
//
// DESC: ISO14443 protocol on NXP Semiconductors PN5180 module for Arduino.
//
// Copyright (c) 2019 by Dirk Carstensen. All rights reserved.
// Copyright (c) 2024 by jef-sure (ESP-IDF robustness patterns).
// Copyright (c) 2025 by Filla IQ (combined best-of-breed rewrite).
//
// This file is part of the PN5180 library for the Arduino environment.
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// Lesser General Public License for more details.
//
//#define DEBUG 1

#include <Arduino.h>
#include "PN5180ISO14443.h"
#include "Debug.h"

PN5180ISO14443::PN5180ISO14443(uint8_t SSpin, uint8_t BUSYpin, uint8_t RSTpin, SPIClass *spi)
              : PN5180(SSpin, BUSYpin, RSTpin, spi) {
}

/*
 * Setup RF for ISO14443A:
 *  1. Load RF config (0x00 TX, 0x80 RX)
 *  2. Turn on RF field
 *  3. Clear crypto mode (bit 6 of SYSTEM_CONFIG)
 */
bool PN5180ISO14443::setupRF() {
  PN5180DEBUG(F("ISO14443 setupRF...\n"));

  if (!loadRFConfig(0x00, 0x80)) {
    PN5180DEBUG(F("ERROR: Load ISO14443A RF config failed!\n"));
    return false;
  }

  if (!setRF_on()) {
    PN5180DEBUG(F("ERROR: Set RF ON failed!\n"));
    return false;
  }

  // Clear crypto mode in case it was left on from a previous session
  writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);

  return true;
}

/*
 * Activate ISO14443A Type A card (anticollision + select).
 *
 * buffer must be 10 bytes:
 *   [0-1] ATQA
 *   [2]   SAK
 *   [3-6] UID (4 byte) or [3-9] UID (7 byte)
 *
 * kind: 0 = REQA, 1 = WUPA
 *
 * Returns:
 *   4 or 7  = UID length on success
 *   0       = no card detected
 *   -1      = general error
 *   -2      = card detected but error during anticollision
 */
int8_t PN5180ISO14443::activateTypeA(uint8_t *buffer, uint8_t kind) {
  uint8_t cmd[7];
  uint8_t uidLength = 0;

  // Load standard TypeA protocol
  if (!loadRFConfig(0x00, 0x80))
    return 0;

  // Clear crypto mode (required before REQA/WUPA)
  writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);

  // Clear RX/TX CRC
  writeRegisterWithAndMask(CRC_RX_CONFIG, 0xFFFFFFFE);
  writeRegisterWithAndMask(CRC_TX_CONFIG, 0xFFFFFFFE);

  // Send REQA (0x26) or WUPA (0x52), 7 bits in last byte
  // sendData() handles idle→transceive→waitTransmit internally
  cmd[0] = (kind == 0) ? 0x26 : 0x52;
  if (!sendData(cmd, 1, 0x07))
    return 0;

  // Wait for response
  delay(5);

  // Read 2 bytes ATQA
  if (!readData(2, buffer)) {
    PN5180DEBUG(F("ERROR: Read ATQA failed!\n"));
    return 0;
  }

  // Send Anti-collision 1 (SEL = 0x93, NVB = 0x20)
  cmd[0] = 0x93;
  cmd[1] = 0x20;
  if (!sendData(cmd, 2, 0x00)) {
    PN5180DEBUG(F("ERROR: Anti-collision 1 failed!\n"));
    return -2;
  }

  // Wait for response
  delay(5);

  uint16_t numBytes = rxBytesReceived();
  if (numBytes != 5) {
    PN5180DEBUG(F("ERROR: Anti-collision 1 response not 5 bytes!\n"));
    return -2;
  }

  // Read 5 bytes (4 UID bytes + BCC), store at cmd[2..6]
  if (!readData(5, cmd + 2)) {
    PN5180DEBUG(F("ERROR: Read anti-collision 1 data failed!\n"));
    return -2;
  }

  // Save first 4 bytes of UID
  for (int i = 0; i < 4; i++) {
    buffer[i] = cmd[2 + i];
  }

  // Enable CRC for SELECT
  if (!writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01)) return -2;
  if (!writeRegisterWithOrMask(CRC_TX_CONFIG, 0x01)) return -2;

  // Send SELECT 1 (SEL = 0x93, NVB = 0x70, + 4 UID bytes + BCC)
  cmd[0] = 0x93;
  cmd[1] = 0x70;
  if (!sendData(cmd, 7, 0x00)) {
    return 4; // No remaining bytes, we have a 4-byte UID
  }

  // Read 1 byte SAK into buffer[2]
  if (!readData(1, buffer + 2)) {
    return -2;
  }

  // Check if 4-byte UID or 7-byte UID (SAK bit 2)
  if ((buffer[2] & 0x04) == 0) {
    // 4-byte UID complete
    for (int i = 0; i < 4; i++) {
      buffer[3 + i] = cmd[2 + i];
    }
    uidLength = 4;
  } else {
    // 7-byte UID: first byte should be CT (0x88)
    if (cmd[2] != 0x88) {
      return 0;
    }
    // Take bytes 1-3 of anti-collision 1 as first 3 bytes of UID
    for (int i = 0; i < 3; i++) {
      buffer[3 + i] = cmd[3 + i];
    }

    // Disable CRC for anti-collision 2
    if (!writeRegisterWithAndMask(CRC_RX_CONFIG, 0xFFFFFFFE)) return -2;
    if (!writeRegisterWithAndMask(CRC_TX_CONFIG, 0xFFFFFFFE)) return -2;

    // Send Anti-collision 2 (SEL = 0x95, NVB = 0x20)
    cmd[0] = 0x95;
    cmd[1] = 0x20;
    if (!sendData(cmd, 2, 0x00)) return -2;

    // Read 5 bytes
    if (!readData(5, cmd + 2)) return -2;

    // Last 4 bytes of UID
    for (int i = 0; i < 4; i++) {
      buffer[6 + i] = cmd[2 + i];
    }

    // Enable CRC for SELECT 2
    if (!writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01)) return -2;
    if (!writeRegisterWithOrMask(CRC_TX_CONFIG, 0x01)) return -2;

    // Send SELECT 2 (SEL = 0x95, NVB = 0x70)
    cmd[0] = 0x95;
    cmd[1] = 0x70;
    if (!sendData(cmd, 7, 0x00)) return -2;

    // Read 1 byte SAK into buffer[2]
    if (!readData(1, buffer + 2)) return -2;

    uidLength = 7;
  }

  return uidLength;
}

/*
 * MIFARE Classic authentication using native PN5180 command 0x0C.
 *
 * Uses the base class mifareAuthenticate() which implements:
 * - Native PN5180 MIFARE_AUTHENTICATE command
 * - Full 5-step cleanup on failure (jef-sure pattern)
 *
 * Parameters match the caller convention: (blockNo, keyType, key, uid, uidLen)
 * Only the first 4 bytes of uid are used per PN5180 datasheet.
 *
 * Returns true on success, false on failure.
 */
bool PN5180ISO14443::mifareAuthenticate(uint8_t blockNo, uint8_t keyType, const uint8_t *key, const uint8_t *uid, uint8_t uidLen) {
  (void)uidLen; // only first 4 bytes used by PN5180
  int16_t result = PN5180::mifareAuthenticate(blockNo, key, keyType, uid);
  return (result == 0x00);
}

/*
 * Read 16 bytes from a MIFARE Classic block.
 * Must be authenticated first.
 */
bool PN5180ISO14443::mifareBlockRead(uint8_t blockno, uint8_t *buffer) {
  uint8_t cmd[2];
  cmd[0] = 0x30; // MIFARE Read command
  cmd[1] = blockno;

  if (!sendData(cmd, 2, 0x00)) {
    PN5180DEBUG(F("ERROR: Send MIFARE Read failed!\n"));
    return false;
  }

  // Wait for response
  delay(5);

  // Check RX status for errors
  uint32_t rxStatus;
  readRegister(RX_STATUS, &rxStatus);

  if (rxStatus & (RX_PROTOCOL_ERROR | RX_DATA_INTEGRITY_ERROR)) {
    PN5180DEBUG(F("ERROR: RX error during MIFARE Read\n"));
    clearIRQStatus(0xFFFFFFFF);
    return false;
  }

  uint16_t len = rxStatus & RX_BYTES_RECEIVED_MASK;

  // MIFARE Classic returns 16 bytes, Ultralight returns 4 or 16
  if (len != 16 && len != 4) {
    PN5180DEBUG(F("ERROR: Unexpected read length\n"));
    clearIRQStatus(0xFFFFFFFF);
    return false;
  }

  if (!readData(len, buffer)) {
    return false;
  }

  return true;
}

/*
 * Write 16 bytes to a MIFARE Classic block.
 * Two-phase write: command+blockno, then 16 bytes data.
 * Returns ACK byte (0x0A on success).
 */
uint8_t PN5180ISO14443::mifareBlockWrite16(uint8_t blockno, const uint8_t *buffer) {
  uint8_t cmd[2];
  uint8_t ack;

  // Clear RX CRC for ACK reception (ACK/NACK are only 4 bits, no CRC)
  writeRegisterWithAndMask(CRC_RX_CONFIG, 0xFFFFFFFE);

  // Phase 1: Write command + block number
  cmd[0] = 0xA0; // MIFARE Write command
  cmd[1] = blockno;
  if (!sendData(cmd, 2, 0x00)) {
    writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);
    return 0;
  }

  // Wait for ACK
  delay(5);

  uint32_t rxStatus;
  readRegister(RX_STATUS, &rxStatus);
  uint16_t rxLen = rxStatus & RX_BYTES_RECEIVED_MASK;

  if (rxLen < 1) {
    writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);
    return 0;
  }
  readData(1, &ack);

  if ((ack & 0x0F) != 0x0A) {
    // NACK received
    writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);
    return ack;
  }

  // Phase 2: Send 16 bytes of data
  if (!sendData(buffer, 16, 0x00)) {
    writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);
    return 0;
  }

  // Wait for final ACK
  delay(10);

  readRegister(RX_STATUS, &rxStatus);
  rxLen = rxStatus & RX_BYTES_RECEIVED_MASK;

  if (rxLen < 1) {
    writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);
    return 0;
  }
  readData(1, &ack);

  // Re-enable RX CRC
  writeRegisterWithOrMask(CRC_RX_CONFIG, 0x01);

  return ack;
}

/*
 * Send HALT command and clear crypto mode.
 */
bool PN5180ISO14443::mifareHalt() {
  uint8_t cmd[2];
  cmd[0] = 0x50; // HALT command
  cmd[1] = 0x00;
  sendData(cmd, 2, 0x00);

  // Clear crypto mode
  writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);

  return true;
}

/*
 * Read card serial (UID).
 *
 * buffer must be at least 10 bytes.
 * Returns UID length (4 or 7) or 0 on no card / invalid UID.
 */
int8_t PN5180ISO14443::readCardSerial(uint8_t *buffer) {
  PN5180DEBUG(F("readCardSerial\n"));

  uint8_t response[10] = { 0 };
  int8_t uidLength = activateTypeA(response, 0);

  if (uidLength <= 0) {
    return uidLength;
  }
  if (uidLength < 4) {
    return 0;
  }

  // Check for invalid ATQA
  if ((response[0] == 0xFF) && (response[1] == 0xFF)) {
    return 0;
  }

  // First UID byte should not be 0x00
  if (response[3] == 0x00) {
    return 0;
  }

  // Check for valid UID (not all 0x00 or 0xFF)
  bool validUID = false;
  for (int i = 1; i < uidLength; i++) {
    if ((response[i + 3] != 0x00) && (response[i + 3] != 0xFF)) {
      validUID = true;
      break;
    }
  }

  // 4-byte UID must not be CT flag
  if (uidLength == 4 && response[3] == 0x88) {
    validUID = false;
  }

  // 7-byte UID: check for invalid patterns
  if (uidLength == 7) {
    if (response[6] == 0x88) {
      validUID = false;
    }
    if ((response[6] == 0x00) && (response[7] == 0x00) && (response[8] == 0x00) && (response[9] == 0x00)) {
      validUID = false;
    }
    if ((response[6] == 0xFF) && (response[7] == 0xFF) && (response[8] == 0xFF) && (response[9] == 0xFF)) {
      validUID = false;
    }
  }

  if (validUID) {
    for (int i = 0; i < uidLength; i++) {
      buffer[i] = response[i + 3];
    }
    return uidLength;
  }

  return 0;
}

/*
 * Quick check if a card is present.
 */
bool PN5180ISO14443::isCardPresent() {
  uint8_t buffer[10];
  return (readCardSerial(buffer) >= 4);
}
