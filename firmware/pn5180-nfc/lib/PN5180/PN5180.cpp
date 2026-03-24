// NAME: PN5180.cpp
//
// DESC: Implementation of PN5180 class.
//
// Copyright (c) 2018 by Andreas Trappmann. All rights reserved.
// Copyright (c) 2019 by Dirk Carstensen.
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
#include "PN5180.h"
#include "Debug.h"

// PN5180 1-Byte Direct Commands
// see 11.4.3.3 Host Interface Command List
#define PN5180_WRITE_REGISTER           (0x00)
#define PN5180_WRITE_REGISTER_OR_MASK   (0x01)
#define PN5180_WRITE_REGISTER_AND_MASK  (0x02)
#define PN5180_READ_REGISTER            (0x04)
#define PN5180_WRITE_EEPROM             (0x06)
#define PN5180_READ_EEPROM              (0x07)
#define PN5180_SEND_DATA                (0x09)
#define PN5180_READ_DATA                (0x0A)
#define PN5180_SWITCH_MODE              (0x0B)
#define PN5180_MIFARE_AUTHENTICATE      (0x0C)
#define PN5180_LOAD_RF_CONFIG           (0x11)
#define PN5180_RF_ON                    (0x16)
#define PN5180_RF_OFF                   (0x17)

uint8_t PN5180::readBuffer[508];

PN5180::PN5180(uint8_t SSpin, uint8_t BUSYpin, uint8_t RSTpin, SPIClass *spi)
  : PN5180_NSS(SSpin),
    PN5180_BUSY(BUSYpin),
    PN5180_RST(RSTpin),
    PN5180_SPI(spi),
    _rfOn(false),
    commandTimeout(200)
{
  /*
   * 11.4.1 Physical Host Interface
   * The interface of the PN5180 to a host microcontroller is based on a SPI interface,
   * extended by signal line BUSY. The maximum SPI speed is 7 Mbps and fixed to CPOL
   * = 0 and CPHA = 0.
   */
  PN5180_SPI_SETTINGS = SPISettings(7000000, MSBFIRST, SPI_MODE0);
}

void PN5180::begin() {
  pinMode(PN5180_NSS, OUTPUT);
  pinMode(PN5180_BUSY, INPUT);
  digitalWrite(PN5180_NSS, HIGH); // disable

  if (PN5180_RST != 0xFF) {
    pinMode(PN5180_RST, OUTPUT);
    digitalWrite(PN5180_RST, HIGH); // no reset
  }

  // Don't call PN5180_SPI->begin() here -- caller must init SPI with correct pins
  // before calling PN5180::begin().
  PN5180DEBUG(F("PN5180 begin\n"));
}

void PN5180::end() {
  digitalWrite(PN5180_NSS, HIGH); // disable
}

/*
 * Wait for BUSY pin to reach specified level with timeout.
 * Returns true if level reached, false on timeout.
 * On timeout: deasserts NSS for safety.
 */
bool PN5180::waitBusy(int level, unsigned long timeoutMs) {
  unsigned long start = millis();
  while (digitalRead(PN5180_BUSY) != level) {
    if (millis() - start > timeoutMs) {
      digitalWrite(PN5180_NSS, HIGH);
      return false;
    }
    yield();
  }
  return true;
}

bool PN5180::isReady() {
  return (digitalRead(PN5180_BUSY) == LOW);
}

/*
 * WRITE_REGISTER - 0x00
 */
bool PN5180::writeRegister(uint8_t reg, uint32_t value) {
  uint8_t *p = (uint8_t*)&value;

#ifdef DEBUG
  PN5180DEBUG(F("Write Register 0x"));
  PN5180DEBUG(formatHex(reg));
  PN5180DEBUG(F(", value (LSB first)=0x"));
  for (int i=0; i<4; i++) {
    PN5180DEBUG(formatHex(p[i]));
  }
  PN5180DEBUG("\n");
#endif

  uint8_t buf[6] = { PN5180_WRITE_REGISTER, reg, p[0], p[1], p[2], p[3] };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(buf, 6);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * WRITE_REGISTER_OR_MASK - 0x01
 */
bool PN5180::writeRegisterWithOrMask(uint8_t reg, uint32_t mask) {
  uint8_t *p = (uint8_t*)&mask;

#ifdef DEBUG
  PN5180DEBUG(F("Write Register 0x"));
  PN5180DEBUG(formatHex(reg));
  PN5180DEBUG(F(" with OR mask (LSB first)=0x"));
  for (int i=0; i<4; i++) {
    PN5180DEBUG(formatHex(p[i]));
  }
  PN5180DEBUG("\n");
#endif

  uint8_t buf[6] = { PN5180_WRITE_REGISTER_OR_MASK, reg, p[0], p[1], p[2], p[3] };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(buf, 6);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * WRITE_REGISTER_AND_MASK - 0x02
 */
bool PN5180::writeRegisterWithAndMask(uint8_t reg, uint32_t mask) {
  uint8_t *p = (uint8_t*)&mask;

#ifdef DEBUG
  PN5180DEBUG(F("Write Register 0x"));
  PN5180DEBUG(formatHex(reg));
  PN5180DEBUG(F(" with AND mask (LSB first)=0x"));
  for (int i=0; i<4; i++) {
    PN5180DEBUG(formatHex(p[i]));
  }
  PN5180DEBUG("\n");
#endif

  uint8_t buf[6] = { PN5180_WRITE_REGISTER_AND_MASK, reg, p[0], p[1], p[2], p[3] };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(buf, 6);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * READ_REGISTER - 0x04
 */
bool PN5180::readRegister(uint8_t reg, uint32_t *value) {
  PN5180DEBUG(F("Reading register 0x"));
  PN5180DEBUG(formatHex(reg));
  PN5180DEBUG(F("...\n"));

  uint8_t cmd[2] = { PN5180_READ_REGISTER, reg };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, 2, (uint8_t*)value, 4);
  PN5180_SPI->endTransaction();

  if (!ret) return false;

  PN5180DEBUG(F("Register value=0x"));
  PN5180DEBUG(formatHex(*value));
  PN5180DEBUG("\n");

  return true;
}

/*
 * WRITE_EEPROM - 0x06
 */
bool PN5180::writeEEprom(uint8_t addr, const uint8_t *buffer, uint8_t len) {
  if ((addr > 254) || ((addr + len) > 254)) {
    PN5180DEBUG(F("ERROR: Writing beyond addr 254!\n"));
    return false;
  }

  uint8_t cmd[len + 2];
  cmd[0] = PN5180_WRITE_EEPROM;
  cmd[1] = addr;
  for (int i = 0; i < len; i++) {
    cmd[2 + i] = buffer[i];
  }

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, len + 2);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * READ_EEPROM - 0x07
 */
bool PN5180::readEEprom(uint8_t addr, uint8_t *buffer, int len) {
  if ((addr > 254) || ((addr + len) > 254)) {
    PN5180DEBUG(F("ERROR: Reading beyond addr 254!\n"));
    return false;
  }

  PN5180DEBUG(F("Reading EEPROM at 0x"));
  PN5180DEBUG(formatHex(addr));
  PN5180DEBUG(F(", size="));
  PN5180DEBUG(len);
  PN5180DEBUG(F("...\n"));

  uint8_t cmd[3] = { PN5180_READ_EEPROM, addr, (uint8_t)len };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, 3, buffer, len);
  PN5180_SPI->endTransaction();

#ifdef DEBUG
  if (ret) {
    PN5180DEBUG(F("EEPROM values: "));
    for (int i = 0; i < len; i++) {
      PN5180DEBUG(formatHex(buffer[i]));
      PN5180DEBUG(" ");
    }
    PN5180DEBUG("\n");
  }
#endif

  return ret;
}

/*
 * SEND_DATA - 0x09
 * Precondition: Transceiver must be in WaitTransmit state with Transceive command set.
 */
bool PN5180::sendData(const uint8_t *data, int len, uint8_t validBits) {
  if (len > 260) {
    PN5180DEBUG(F("ERROR: sendData with more than 260 bytes is not supported!\n"));
    return false;
  }

#ifdef DEBUG
  PN5180DEBUG(F("Send data (len="));
  PN5180DEBUG(len);
  PN5180DEBUG(F("):"));
  for (int i = 0; i < len; i++) {
    PN5180DEBUG(" ");
    PN5180DEBUG(formatHex(data[i]));
  }
  PN5180DEBUG("\n");
#endif

  uint8_t buffer[len + 2];
  buffer[0] = PN5180_SEND_DATA;
  buffer[1] = validBits;
  for (int i = 0; i < len; i++) {
    buffer[2 + i] = data[i];
  }

  // Set idle, then transceive
  writeRegisterWithAndMask(SYSTEM_CONFIG, 0xFFFFFFF8);  // Idle/StopCom
  writeRegisterWithOrMask(SYSTEM_CONFIG, 0x00000003);   // Transceive Command

  // Wait for WaitTransmit state with timeout
  unsigned long start = millis();
  PN5180TransceiveStat state = getTransceiveState();
  while (PN5180_TS_WaitTransmit != state) {
    if (millis() - start > commandTimeout) {
      PN5180DEBUG(F("ERROR: Transceiver not in state WaitTransmit!\n"));
      return false;
    }
    state = getTransceiveState();
    yield();
  }

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(buffer, len + 2);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * READ_DATA - 0x0A
 * Returns pointer to internal static buffer (508 bytes).
 */
uint8_t * PN5180::readData(int len) {
  if (len < 0 || len > 508) {
    PN5180DEBUG(F("ERROR: readData length out of range!\n"));
    return 0L;
  }

  uint8_t cmd[2] = { PN5180_READ_DATA, 0x00 };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, 2, readBuffer, len);
  PN5180_SPI->endTransaction();

  if (!ret) return 0L;

#ifdef DEBUG
  PN5180DEBUG(F("Data read: "));
  for (int i = 0; i < len; i++) {
    PN5180DEBUG(formatHex(readBuffer[i]));
    PN5180DEBUG(" ");
  }
  PN5180DEBUG("\n");
#endif

  return readBuffer;
}

/*
 * READ_DATA into caller-provided buffer.
 */
bool PN5180::readData(int len, uint8_t *buffer) {
  if (len < 0 || len > 508) {
    return false;
  }
  uint8_t cmd[2] = { PN5180_READ_DATA, 0x00 };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, 2, buffer, len);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * Prepare LPCD registers (Low Power Card Detection)
 */
bool PN5180::prepareLPCD() {
  PN5180DEBUG(F("Prepare LPCD...\n"));
  uint8_t data[1];
  uint8_t response[1];

  // 1. Set Field on time
  data[0] = 0xF0;
  if (!writeEEprom(LPCD_FIELD_ON_TIME, data, 1)) return false;
  if (!readEEprom(LPCD_FIELD_ON_TIME, response, 1)) return false;

  // 2. Set threshold level
  data[0] = 0x03;
  if (!writeEEprom(LPCD_THRESHOLD, data, 1)) return false;
  if (!readEEprom(LPCD_THRESHOLD, response, 1)) return false;

  // 3. Select LPCD mode (self calibration)
  data[0] = 0x01;
  if (!writeEEprom(LPCD_REFVAL_GPO_CONTROL, data, 1)) return false;
  if (!readEEprom(LPCD_REFVAL_GPO_CONTROL, response, 1)) return false;

  // 4. GPO toggle before field on
  data[0] = 0xF0;
  if (!writeEEprom(LPCD_GPO_TOGGLE_BEFORE_FIELD_ON, data, 1)) return false;
  if (!readEEprom(LPCD_GPO_TOGGLE_BEFORE_FIELD_ON, response, 1)) return false;

  // 5. GPO toggle after field on
  data[0] = 0xF0;
  if (!writeEEprom(LPCD_GPO_TOGGLE_AFTER_FIELD_ON, data, 1)) return false;
  if (!readEEprom(LPCD_GPO_TOGGLE_AFTER_FIELD_ON, response, 1)) return false;

  return true;
}

/*
 * Switch to LPCD mode.
 * Parameter 'wakeupCounterInMs' must be in the range from 0x0 - 0xA82
 * max. wake-up time is 2960 ms.
 */
bool PN5180::switchToLPCD(uint16_t wakeupCounterInMs) {
  clearIRQStatus(0xFFFFFFFF);
  writeRegister(IRQ_ENABLE, LPCD_IRQ_STAT | GENERAL_ERROR_IRQ_STAT);

  uint8_t cmd[] = {
    PN5180_SWITCH_MODE, 0x01,
    (uint8_t)(wakeupCounterInMs & 0xFF),
    (uint8_t)((wakeupCounterInMs >> 8U) & 0xFF)
  };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, sizeof(cmd));
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * MIFARE_AUTHENTICATE - 0x0C (native PN5180 command)
 *
 * This command performs MIFARE Classic Authentication on an activated card.
 * Format: [Cmd=0x0C][Key(6)][KeyType][BlockNo][UID(4)] = 13 bytes
 * Response: 1 byte (0x00 = success)
 *
 * On failure: performs full 5-step cleanup (jef-sure pattern):
 *  1. Clear crypto mode (SYSTEM_CONFIG bit 6)
 *  2. Set transceiver to idle
 *  3. Flush RX buffer
 *  4. Clear all IRQs
 *  5. Wait for idle transceive state
 */
int16_t PN5180::mifareAuthenticate(uint8_t blockNo, const uint8_t *key, uint8_t keyType, const uint8_t *uid) {
  if (keyType != MIFARE_CLASSIC_KEYA && keyType != MIFARE_CLASSIC_KEYB) {
    PN5180DEBUG(F("ERROR: invalid key type!\n"));
    return -2;
  }

  uint8_t cmdBuffer[13];
  uint8_t rcvBuffer[1] = {0xFF};

  // Format per PN5180 datasheet: [Cmd][Key(6)][KeyType][Block][UID(4)]
  cmdBuffer[0] = PN5180_MIFARE_AUTHENTICATE;
  memcpy(&cmdBuffer[1], key, 6);
  cmdBuffer[7] = keyType;
  cmdBuffer[8] = blockNo;
  memcpy(&cmdBuffer[9], uid, 4);

#ifdef DEBUG
  PN5180DEBUG(F("AUTH cmd: [Cmd=0x0C][Key="));
  for (int i = 0; i < 6; i++) { PN5180DEBUG(formatHex(key[i])); PN5180DEBUG(" "); }
  PN5180DEBUG(F("][KeyType=0x"));
  PN5180DEBUG(formatHex(keyType));
  PN5180DEBUG(F("][Block=0x"));
  PN5180DEBUG(formatHex(blockNo));
  PN5180DEBUG(F("][UID="));
  for (int i = 0; i < 4; i++) { PN5180DEBUG(formatHex(uid[i])); PN5180DEBUG(" "); }
  PN5180DEBUG(F("]\n"));
#endif

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool rc = transceiveCommand(cmdBuffer, 13, rcvBuffer, 1);
  PN5180_SPI->endTransaction();

  if (!rc) {
    PN5180DEBUG(F("ERROR: MIFARE auth SPI transaction failed!\n"));
    mifareAuthCleanup();
    return -3;
  }

  PN5180DEBUG(F("AUTH response: 0x"));
  PN5180DEBUG(formatHex(rcvBuffer[0]));
  PN5180DEBUG("\n");

  if (rcvBuffer[0] != 0x00) {
    // Authentication failed -- full 5-step cleanup (jef-sure pattern)
    PN5180DEBUG(F("AUTH failed, cleaning up...\n"));
    mifareAuthCleanup();
    return rcvBuffer[0];
  }

  // Success -- wait briefly for transceiver readiness
  unsigned long start = millis();
  PN5180TransceiveStat tstate;
  do {
    tstate = getTransceiveState();
    if (tstate == PN5180_TS_WaitTransmit || tstate == PN5180_TS_Idle) {
      break;
    }
    yield();
  } while (millis() - start < 50);

  clearIRQStatus(0xFFFFFFFF);

  return 0x00;
}

/*
 * 5-step MIFARE authentication cleanup (from jef-sure pattern):
 * 1. Clear crypto mode
 * 2. Set transceiver idle
 * 3. Flush RX buffer
 * 4. Clear all IRQs
 * 5. Wait for idle transceive state
 */
void PN5180::mifareAuthCleanup() {
  // Step 1: Clear MFC_CRYPTO_ON bit
  writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);

  // Step 2: Set transceiver to idle
  writeRegisterWithAndMask(SYSTEM_CONFIG, 0xFFFFFFF8);

  // Step 3: Flush any stale data from RX buffer
  uint32_t rxStatus;
  if (readRegister(RX_STATUS, &rxStatus)) {
    uint16_t rxLen = rxStatus & RX_BYTES_RECEIVED_MASK;
    if (rxLen > 0 && rxLen <= 508) {
      uint8_t dummy[16]; // only need to issue the command, not store all data
      readData((rxLen <= 16) ? rxLen : 16, dummy);
    }
  }

  // Step 4: Clear all IRQs
  clearIRQStatus(0xFFFFFFFF);

  // Step 5: Wait for transceiver to reach idle state
  unsigned long start = millis();
  PN5180TransceiveStat tstate;
  do {
    tstate = getTransceiveState();
    if (tstate == PN5180_TS_Idle) break;
    yield();
  } while (millis() - start < 50);
}

/*
 * LOAD_RF_CONFIG - 0x11
 */
bool PN5180::loadRFConfig(uint8_t txConf, uint8_t rxConf) {
  PN5180DEBUG(F("Load RF-Config: txConf="));
  PN5180DEBUG(formatHex(txConf));
  PN5180DEBUG(F(", rxConf="));
  PN5180DEBUG(formatHex(rxConf));
  PN5180DEBUG("\n");

  uint8_t cmd[3] = { PN5180_LOAD_RF_CONFIG, txConf, rxConf };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(cmd, 3);
  PN5180_SPI->endTransaction();

  return ret;
}

/*
 * RF_ON - 0x16
 * Retry up to 3 times, check both IRQ status AND RF_STATUS register (jef-sure pattern).
 * Track _rfOn state to skip redundant calls.
 */
bool PN5180::setRF_on() {
  if (_rfOn) return true;  // Already on

  uint8_t cmd[2] = { PN5180_RF_ON, 0x00 };

  for (int attempt = 0; attempt < 3; attempt++) {
    clearIRQStatus(0xFFFFFFFF);

    PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
    bool rc = transceiveCommand(cmd, 2);
    PN5180_SPI->endTransaction();

    if (!rc) {
      PN5180DEBUG(F("RF ON transceive failed\n"));
      continue;
    }

    // Wait for RF field to come up -- check both IRQ and RF_STATUS register
    unsigned long start = millis();
    uint32_t irqStatus = 0;
    uint32_t rfStatus = 0;

    while (millis() - start < commandTimeout) {
      irqStatus = getIRQStatus();
      if (irqStatus & (RFON_DET_IRQ_STAT | TX_RFON_IRQ_STAT)) {
        clearIRQStatus(RFON_DET_IRQ_STAT | TX_RFON_IRQ_STAT);
        _rfOn = true;
        return true;
      }
      if (readRegister(RF_STATUS, &rfStatus) && (rfStatus & 0x01)) {
        _rfOn = true;
        return true;
      }
      yield();
    }

    // Brief delay before retry with escalating backoff
    delay(10 * (attempt + 1));
  }

  PN5180DEBUG(F("ERROR: RF field failed to turn on after 3 attempts\n"));
  return false;
}

/*
 * RF_OFF - 0x17
 * With timeout, clear _rfOn state.
 */
bool PN5180::setRF_off() {
  // Check if already off
  uint32_t rfStatus = 0;
  if (readRegister(RF_STATUS, &rfStatus)) {
    if ((rfStatus & 0x01) == 0) {
      _rfOn = false;
      return true;
    }
  }

  uint8_t cmd[2] = { PN5180_RF_OFF, 0x00 };

  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool rc = transceiveCommand(cmd, 2);
  PN5180_SPI->endTransaction();

  if (!rc) {
    PN5180DEBUG(F("RF OFF transceive failed\n"));
    return false;
  }

  unsigned long start = millis();
  while (millis() - start < commandTimeout) {
    uint32_t irq = getIRQStatus();
    if (irq & TX_RFOFF_IRQ_STAT) {
      clearIRQStatus(TX_RFOFF_IRQ_STAT);
      _rfOn = false;
      return true;
    }
    if (readRegister(RF_STATUS, &rfStatus) && ((rfStatus & 0x01) == 0)) {
      _rfOn = false;
      return true;
    }
    yield();
  }

  PN5180DEBUG(F("ERROR: RF OFF timeout\n"));
  _rfOn = false; // assume off even on timeout
  return false;
}

bool PN5180::sendCommand(uint8_t *sendBuffer, size_t sendBufferLen, uint8_t *recvBuffer, size_t recvBufferLen) {
  PN5180_SPI->beginTransaction(PN5180_SPI_SETTINGS);
  bool ret = transceiveCommand(sendBuffer, sendBufferLen, recvBuffer, recvBufferLen);
  PN5180_SPI->endTransaction();
  return ret;
}

//---------------------------------------------------------------------------------------------

/*
 * SPI transceive with BUSY line handling and timeout at every wait point.
 * On timeout: deasserts NSS, returns false.
 *
 * Protocol (per PN5180 datasheet):
 * Phase 1 - Send:
 *   0. Wait BUSY low (ready)
 *   1. Assert NSS
 *   2. SPI transfer
 *   3. Wait BUSY high (processing)
 *   4. Deassert NSS
 *   5. Wait BUSY low (done)
 * Phase 2 - Receive (if recvBuffer != NULL):
 *   1. Assert NSS
 *   2. SPI receive
 *   3. Wait BUSY high
 *   4. Deassert NSS
 *   5. Wait BUSY low
 */
bool PN5180::transceiveCommand(uint8_t *sendBuffer, size_t sendBufferLen, uint8_t *recvBuffer, size_t recvBufferLen) {
#ifdef DEBUG
  PN5180DEBUG(F("Sending SPI frame: '"));
  for (uint8_t i = 0; i < sendBufferLen; i++) {
    if (i > 0) PN5180DEBUG(" ");
    PN5180DEBUG(formatHex(sendBuffer[i]));
  }
  PN5180DEBUG("'\n");
#endif

  // 0. Wait until BUSY is low
  if (!waitBusy(LOW, commandTimeout)) {
    PN5180DEBUG(F("BUSY timeout (pre-send)\n"));
    return false;
  }
  // 1. Assert NSS
  digitalWrite(PN5180_NSS, LOW);
  delay(2);  // PN5180 needs 1-2ms after NSS assertion
  // 2. SPI transfer
  for (uint8_t i = 0; i < sendBufferLen; i++) {
    PN5180_SPI->transfer(sendBuffer[i]);
  }
  // 3. Wait BUSY high
  if (!waitBusy(HIGH, commandTimeout)) {
    PN5180DEBUG(F("BUSY timeout (post-send)\n"));
    return false;
  }
  // 4. Deassert NSS
  digitalWrite(PN5180_NSS, HIGH);
  delay(1);  // PN5180 needs time after NSS deassert
  // 5. Wait BUSY low
  if (!waitBusy(LOW, commandTimeout)) {
    PN5180DEBUG(F("BUSY timeout (idle after send)\n"));
    return false;
  }

  // Check if write-only
  if ((0 == recvBuffer) || (0 == recvBufferLen)) {
    return true;
  }

  PN5180DEBUG(F("Receiving SPI frame...\n"));

  // 1. Assert NSS
  digitalWrite(PN5180_NSS, LOW);
  delay(2);  // PN5180 needs 1-2ms after NSS assertion
  // 2. SPI receive
  for (uint8_t i = 0; i < recvBufferLen; i++) {
    recvBuffer[i] = PN5180_SPI->transfer(0xFF);
  }
  // 3. Wait BUSY high
  if (!waitBusy(HIGH, commandTimeout)) {
    PN5180DEBUG(F("BUSY timeout (post-recv)\n"));
    return false;
  }
  // 4. Deassert NSS
  digitalWrite(PN5180_NSS, HIGH);
  delay(1);  // PN5180 needs time after NSS deassert
  // 5. Wait BUSY low
  if (!waitBusy(LOW, commandTimeout)) {
    PN5180DEBUG(F("BUSY timeout (idle after recv)\n"));
    return false;
  }

#ifdef DEBUG
  PN5180DEBUG(F("Received: '"));
  for (uint8_t i = 0; i < recvBufferLen; i++) {
    if (i > 0) PN5180DEBUG(" ");
    PN5180DEBUG(formatHex(recvBuffer[i]));
  }
  PN5180DEBUG("'\n");
#endif

  return true;
}

/*
 * Hardware reset via RST pin with retry logic (jef-sure pattern).
 *
 * If RST pin is available (not 0xFF):
 *   - Pulse RST low, wait for BUSY LOW then IDLE_IRQ
 *   - Retry up to 3 times with escalating delays
 * If RST pin is not available:
 *   - Wait for BUSY low and IDLE_IRQ with timeout
 *
 * Returns true on success, false on failure.
 */
bool PN5180::reset() {
  // Abort any in-progress SPI transaction
  digitalWrite(PN5180_NSS, HIGH);
  delay(2);

  if (PN5180_RST == 0xFF) {
    // No RST pin -- just wait for BUSY and IDLE_IRQ
    if (!waitBusy(LOW, 500)) {
      return false;
    }
    unsigned long start = millis();
    while (0 == (IDLE_IRQ_STAT & getIRQStatus())) {
      if (millis() - start > commandTimeout) {
        return false;
      }
      yield();
    }
    clearIRQStatus(0xFFFFFFFF);
    _rfOn = false;
    return true;
  }

  // Hardware reset with retry (up to 3 attempts with escalating delays)
  for (int attempt = 0; attempt < 3; attempt++) {
    // Pulse RST
    digitalWrite(PN5180_RST, LOW);
    delay(10 + attempt * 10);  // Escalating pulse width
    digitalWrite(PN5180_RST, HIGH);
    delay(10 + attempt * 20);  // Escalating ramp-up time

    // Wait for BUSY to go LOW
    if (!waitBusy(LOW, 2000)) {
      PN5180DEBUG(F("Reset: BUSY stuck high\n"));
      continue;
    }

    // Wait for IDLE_IRQ
    unsigned long start = millis();
    bool gotIdle = false;
    while (millis() - start < commandTimeout) {
      if (IDLE_IRQ_STAT & getIRQStatus()) {
        gotIdle = true;
        break;
      }
      yield();
    }

    if (!gotIdle) {
      PN5180DEBUG(F("Reset: IDLE_IRQ not set\n"));
      continue;
    }

    // Final check: BUSY should be low
    if (!waitBusy(LOW, 500)) {
      PN5180DEBUG(F("Reset: BUSY stuck high after IDLE_IRQ\n"));
      continue;
    }

    clearIRQStatus(0xFFFFFFFF);
    _rfOn = false;
    return true;
  }

  PN5180DEBUG(F("ERROR: Reset failed after 3 attempts\n"));
  return false;
}

/*
 * Read IRQ status register
 */
uint32_t PN5180::getIRQStatus() {
  uint32_t irqStatus;
  readRegister(IRQ_STATUS, &irqStatus);
  return irqStatus;
}

bool PN5180::clearIRQStatus(uint32_t irqMask) {
  return writeRegister(IRQ_CLEAR, irqMask);
}

/*
 * Get number of bytes received in last RF reception
 */
uint32_t PN5180::rxBytesReceived() {
  uint32_t rxStatus;
  if (!readRegister(RX_STATUS, &rxStatus)) {
    return 0;
  }
  return rxStatus & RX_BYTES_RECEIVED_MASK;
}

/*
 * Get TRANSCEIVE_STATE from RF_STATUS register
 */
PN5180TransceiveStat PN5180::getTransceiveState() {
  uint32_t rfStatus;
  if (!readRegister(RF_STATUS, &rfStatus)) {
    PN5180DEBUG(F("ERROR reading RF_STATUS\n"));
    return PN5180TransceiveStat(0);
  }

  uint8_t state = ((rfStatus >> 24) & 0x07);
  return PN5180TransceiveStat(state);
}
