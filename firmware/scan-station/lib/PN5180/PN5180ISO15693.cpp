// NAME: PN5180ISO15693.cpp
//
// DESC: ISO15693 protocol on NXP Semiconductors PN5180 module for Arduino.
//
// Copyright (c) 2018 by Andreas Trappmann. All rights reserved.
// Copyright (c) 2019 by Dirk Carstensen (tueddy - multi-tag support).
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
#include "PN5180ISO15693.h"
#include "Debug.h"

PN5180ISO15693::PN5180ISO15693(uint8_t SSpin, uint8_t BUSYpin, uint8_t RSTpin, SPIClass *spi)
              : PN5180(SSpin, BUSYpin, RSTpin, spi) {
}

/*
 * Setup RF for ISO15693:
 *  1. Load RF config (0x0D TX ASK100, 0x8D RX)
 *  2. Turn on RF field
 *  3. Set transceiver to transceive mode
 */
bool PN5180ISO15693::setupRF() {
  PN5180DEBUG(F("ISO15693 setupRF...\n"));

  if (!loadRFConfig(0x0D, 0x8D)) {
    PN5180DEBUG(F("ERROR: Load ISO15693 RF config failed!\n"));
    return false;
  }

  if (!setRF_on()) {
    PN5180DEBUG(F("ERROR: Set RF ON failed!\n"));
    return false;
  }

  writeRegisterWithAndMask(SYSTEM_CONFIG, 0xFFFFFFF8);  // Idle/StopCom
  writeRegisterWithOrMask(SYSTEM_CONFIG, 0x00000003);   // Transceive Command

  return true;
}

/*
 * Single-slot inventory, code=01
 *
 * Request:  SOF, Flags(0x26), Inventory(0x01), MaskLen(0x00), CRC16, EOF
 * Response: SOF, Resp.Flags, DSFID, UID(8), CRC16, EOF
 */
ISO15693ErrorCode PN5180ISO15693::getInventory(uint8_t *uid) {
  //                     Flags,  CMD, maskLen
  uint8_t inventory[] = { 0x26, 0x01, 0x00 };
  //                        |\- inventory flag + high data rate
  //                        \-- 1 slot, no AFI

  PN5180DEBUG(F("Get Inventory...\n"));

  for (int i = 0; i < 8; i++) {
    uid[i] = 0;
  }

  uint8_t *readBuf;
  ISO15693ErrorCode rc = issueISO15693Command(inventory, sizeof(inventory), &readBuf);
  if (ISO15693_EC_OK != rc) {
    return rc;
  }

#ifdef DEBUG
  PN5180DEBUG(F("Response flags: "));
  PN5180DEBUG(formatHex(readBuf[0]));
  PN5180DEBUG(F(", DSFID: "));
  PN5180DEBUG(formatHex(readBuf[1]));
  PN5180DEBUG(F(", UID: "));
#endif

  for (int i = 0; i < 8; i++) {
    uid[i] = readBuf[2 + i];
#ifdef DEBUG
    PN5180DEBUG(formatHex(uid[7 - i]));
    if (i < 2) PN5180DEBUG(":");
#endif
  }

  PN5180DEBUG("\n");

  return ISO15693_EC_OK;
}

/*
 * Multi-tag inventory using 16 time slots (tueddy pattern).
 *
 * uid: buffer for multiple UIDs, 8 bytes per tag (uid[0..7] = tag 1, uid[8..15] = tag 2, etc.)
 * maxTags: maximum number of tags to detect
 * numCard: output - number of cards found
 */
ISO15693ErrorCode PN5180ISO15693::getInventoryMultiple(uint8_t *uid, uint8_t maxTags, uint8_t *numCard) {
  PN5180DEBUG(F("getInventoryMultiple\n"));

  uint16_t collision[maxTags];
  *numCard = 0;
  uint8_t numCol = 0;

  inventoryPoll(uid, maxTags, numCard, &numCol, collision);

  PN5180DEBUG(F("Collisions: "));
  PN5180DEBUG(numCol);
  PN5180DEBUG("\n");

  // Resolve collisions by re-polling with mask
  while (numCol) {
    inventoryPoll(uid, maxTags, numCard, &numCol, collision);
    numCol--;
    for (int i = 0; i < numCol; i++) {
      collision[i] = collision[i + 1];
    }
  }

  return ISO15693_EC_OK;
}

ISO15693ErrorCode PN5180ISO15693::inventoryPoll(uint8_t *uid, uint8_t maxTags, uint8_t *numCard, uint8_t *numCol, uint16_t *collision) {
  PN5180DEBUG(F("inventoryPoll\n"));

  uint8_t maskLen = 0;
  if (*numCol > 0) {
    uint32_t mask = collision[0];
    do {
      mask >>= 4L;
      maskLen++;
    } while (mask > 0);
  }

  uint8_t *p = (uint8_t*)&(collision[0]);
  //                      Flags,  CMD
  const uint8_t inventory[7] = { 0x06, 0x01, uint8_t(maskLen * 4), p[0], p[1], p[2], p[3] };
  //                         |\- inventory flag + high data rate
  //                         \-- 16 slots, no AFI
  uint8_t cmdLen = 3 + (maskLen / 2) + (maskLen % 2);

  clearIRQStatus(0x000FFFFF);
  sendData(inventory, cmdLen, 0);

  for (uint8_t slot = 0; slot < 16; slot++) {
    uint32_t rxStatus;
    uint32_t irqStatus = getIRQStatus();
    readRegister(RX_STATUS, &rxStatus);

    uint16_t len = (uint16_t)(rxStatus & 0x000001FF);

    if ((rxStatus >> 18) & 0x01 && *numCol < maxTags) {
      // Collision detected
      if (maskLen > 0) {
        collision[*numCol] = collision[0] | (slot << (maskLen * 2));
      } else {
        collision[*numCol] = slot << (maskLen * 2);
      }
      *numCol = *numCol + 1;
    } else if (!(irqStatus & RX_IRQ_STAT) && !len) {
      // No card in this time slot
    } else {
      // Card responded
      uint8_t *readBuf = readData(len + 1);
      if (0L == readBuf) {
        PN5180DEBUG(F("ERROR in readData!\n"));
        return ISO15693_EC_UNKNOWN_ERROR;
      }

      // Record UID data
      for (int i = 0; i < 8; i++) {
        uint8_t startAddr = (*numCard * 8) + i;
        uid[startAddr] = readBuf[2 + i];
      }
      *numCard = *numCard + 1;
    }

    if (slot + 1 < 16) {
      writeRegisterWithAndMask(TX_CONFIG, 0xFFFFFB3F);  // Next SEND_DATA = EOF only
      clearIRQStatus(0x000FFFFF);
      sendData(inventory, 0, 0);                         // Send EOF
    }
  }

  setRF_off();
  setupRF();

  return ISO15693_EC_OK;
}

/*
 * Read single block, code=20
 */
ISO15693ErrorCode PN5180ISO15693::readSingleBlock(const uint8_t *uid, uint8_t blockNo, uint8_t *blockData, uint8_t blockSize) {
  //                            flags, cmd, uid,             blockNo
  uint8_t readCmd[] = { 0x22, 0x20, 1,2,3,4,5,6,7,8, blockNo };
  //                      |\- high data rate
  //                      \-- addressed by UID
  for (int i = 0; i < 8; i++) {
    readCmd[2 + i] = uid[i];
  }

#ifdef DEBUG
  PN5180DEBUG(F("Read Single Block #"));
  PN5180DEBUG(blockNo);
  PN5180DEBUG(F(", size="));
  PN5180DEBUG(blockSize);
  PN5180DEBUG("\n");
#endif

  uint8_t *resultPtr;
  ISO15693ErrorCode rc = issueISO15693Command(readCmd, sizeof(readCmd), &resultPtr);
  if (ISO15693_EC_OK != rc) {
    return rc;
  }

  for (int i = 0; i < blockSize; i++) {
    blockData[i] = resultPtr[1 + i];
  }

  return ISO15693_EC_OK;
}

/*
 * Write single block, code=21
 */
ISO15693ErrorCode PN5180ISO15693::writeSingleBlock(const uint8_t *uid, uint8_t blockNo, const uint8_t *blockData, uint8_t blockSize) {
  uint8_t writeCmdSize = 11 + blockSize;
  uint8_t *writeCmd = (uint8_t*)malloc(writeCmdSize);
  if (!writeCmd) return ISO15693_EC_UNKNOWN_ERROR;

  uint8_t pos = 0;
  writeCmd[pos++] = 0x22; // flags: addressed, high data rate
  writeCmd[pos++] = 0x21; // Write Single Block
  for (int i = 0; i < 8; i++) {
    writeCmd[pos++] = uid[i];
  }
  writeCmd[pos++] = blockNo;
  for (int i = 0; i < blockSize; i++) {
    writeCmd[pos++] = blockData[i];
  }

#ifdef DEBUG
  PN5180DEBUG(F("Write Single Block #"));
  PN5180DEBUG(blockNo);
  PN5180DEBUG(F(", size="));
  PN5180DEBUG(blockSize);
  PN5180DEBUG("\n");
#endif

  uint8_t *resultPtr;
  ISO15693ErrorCode rc = issueISO15693Command(writeCmd, writeCmdSize, &resultPtr);
  free(writeCmd);

  return rc;
}

/*
 * Read multiple blocks, code=23
 */
ISO15693ErrorCode PN5180ISO15693::readMultipleBlock(const uint8_t *uid, uint8_t blockNo, uint8_t numBlock, uint8_t *blockData, uint8_t blockSize) {
  if (blockNo > numBlock - 1) {
    return ISO15693_EC_BLOCK_NOT_AVAILABLE;
  }

  //                              flags, cmd, uid,             1stBlock, blocksToRead
  uint8_t readMultipleCmd[12] = { 0x22, 0x23, 1,2,3,4,5,6,7,8, blockNo, uint8_t(numBlock - 1) };
  for (int i = 0; i < 8; i++) {
    readMultipleCmd[2 + i] = uid[i];
  }

  uint8_t *resultPtr;
  ISO15693ErrorCode rc = issueISO15693Command(readMultipleCmd, sizeof(readMultipleCmd), &resultPtr);
  if (ISO15693_EC_OK != rc) return rc;

  for (int i = 0; i < numBlock * blockSize; i++) {
    blockData[i] = resultPtr[1 + i];
  }

  return ISO15693_EC_OK;
}

/*
 * Get System Information, code=2B
 */
ISO15693ErrorCode PN5180ISO15693::getSystemInfo(uint8_t *uid, uint8_t *blockSize, uint8_t *numBlocks) {
  uint8_t sysInfo[] = { 0x22, 0x2b, 1,2,3,4,5,6,7,8 };
  for (int i = 0; i < 8; i++) {
    sysInfo[2 + i] = uid[i];
  }

#ifdef DEBUG
  PN5180DEBUG(F("Get System Information\n"));
#endif

  uint8_t *readBuf;
  ISO15693ErrorCode rc = issueISO15693Command(sysInfo, sizeof(sysInfo), &readBuf);
  if (ISO15693_EC_OK != rc) {
    return rc;
  }

  for (int i = 0; i < 8; i++) {
    uid[i] = readBuf[2 + i];
  }

  uint8_t *p = &readBuf[10];
  uint8_t infoFlags = readBuf[1];

  if (infoFlags & 0x01) { // DSFID flag
    p++; // skip DSFID
  }
  if (infoFlags & 0x02) { // AFI flag
    p++; // skip AFI
  }
  if (infoFlags & 0x04) { // VICC Memory size
    *numBlocks = *p++;
    *blockSize = *p++;
    *blockSize = (*blockSize) & 0x1F;
    *blockSize = *blockSize + 1; // range: 1-32
    *numBlocks = *numBlocks + 1; // range: 1-256

    PN5180DEBUG(F("VICC MemSize="));
    PN5180DEBUG(uint16_t(*blockSize) * (*numBlocks));
    PN5180DEBUG(F(" BlockSize="));
    PN5180DEBUG(*blockSize);
    PN5180DEBUG(F(" NumBlocks="));
    PN5180DEBUG(*numBlocks);
    PN5180DEBUG("\n");
  }

  return ISO15693_EC_OK;
}

// --- ICODE SLIX2 specific commands ---

ISO15693ErrorCode PN5180ISO15693::getRandomNumber(uint8_t *randomData) {
  uint8_t getrandom[] = {0x02, 0xB2, 0x04};
  uint8_t *readBuf;
  ISO15693ErrorCode rc = issueISO15693Command(getrandom, sizeof(getrandom), &readBuf);
  if (rc == ISO15693_EC_OK) {
    randomData[0] = readBuf[1];
    randomData[1] = readBuf[2];
  }
  return rc;
}

ISO15693ErrorCode PN5180ISO15693::setPassword(uint8_t identifier, const uint8_t *password, const uint8_t *random) {
  uint8_t setPwd[] = {0x02, 0xB3, 0x04, identifier, 0x00, 0x00, 0x00, 0x00};
  uint8_t *readBuf;
  setPwd[4] = password[0] ^ random[0];
  setPwd[5] = password[1] ^ random[1];
  setPwd[6] = password[2] ^ random[0];
  setPwd[7] = password[3] ^ random[1];
  return issueISO15693Command(setPwd, sizeof(setPwd), &readBuf);
}

ISO15693ErrorCode PN5180ISO15693::enablePrivacy(const uint8_t *password, const uint8_t *random) {
  uint8_t setPrivacy[] = {0x02, 0xBA, 0x04, 0x00, 0x00, 0x00, 0x00};
  uint8_t *readBuf;
  setPrivacy[3] = password[0] ^ random[0];
  setPrivacy[4] = password[1] ^ random[1];
  setPrivacy[5] = password[2] ^ random[0];
  setPrivacy[6] = password[3] ^ random[1];
  return issueISO15693Command(setPrivacy, sizeof(setPrivacy), &readBuf);
}

ISO15693ErrorCode PN5180ISO15693::disablePrivacyMode(const uint8_t *password) {
  uint8_t random[] = {0x00, 0x00};
  ISO15693ErrorCode rc = getRandomNumber(random);
  if (rc != ISO15693_EC_OK) return rc;
  return setPassword(0x04, password, random);
}

ISO15693ErrorCode PN5180ISO15693::enablePrivacyMode(const uint8_t *password) {
  uint8_t random[] = {0x00, 0x00};
  ISO15693ErrorCode rc = getRandomNumber(random);
  if (rc != ISO15693_EC_OK) return rc;
  return enablePrivacy(password, random);
}

/*
 * Issue an ISO15693 command, wait for response, check for errors.
 * Returns a pointer to the internal read buffer on success.
 */
ISO15693ErrorCode PN5180ISO15693::issueISO15693Command(const uint8_t *cmd, uint8_t cmdLen, uint8_t **resultPtr) {
#ifdef DEBUG
  PN5180DEBUG(F("Issue Command 0x"));
  PN5180DEBUG(formatHex(cmd[1]));
  PN5180DEBUG("...\n");
#endif

  sendData(cmd, cmdLen);
  delay(10);

  uint32_t irqR = getIRQStatus();
  if (0 == (irqR & RX_SOF_DET_IRQ_STAT)) {
    PN5180DEBUG(F("No RX_SOF_DET_IRQ after sendData\n"));
    return EC_NO_CARD;
  }

  unsigned long start = millis();
  while (!(irqR & RX_IRQ_STAT)) {
    irqR = getIRQStatus();
    if (millis() - start > commandTimeout) {
      PN5180DEBUG(F("RX_IRQ timeout\n"));
      return EC_NO_CARD;
    }
    yield();
  }

  uint32_t rxStatus;
  readRegister(RX_STATUS, &rxStatus);

  uint16_t len = (uint16_t)(rxStatus & 0x000001FF);

  PN5180DEBUG(F("RX-Status="));
  PN5180DEBUG(formatHex(rxStatus));
  PN5180DEBUG(F(", len="));
  PN5180DEBUG(len);
  PN5180DEBUG("\n");

  *resultPtr = readData(len);
  if (0L == *resultPtr) {
    PN5180DEBUG(F("ERROR in readData!\n"));
    return ISO15693_EC_UNKNOWN_ERROR;
  }

#ifdef DEBUG
  for (int i = 0; i < len; i++) {
    PN5180DEBUG(formatHex((*resultPtr)[i]));
    if (i < len - 1) PN5180DEBUG(":");
  }
  PN5180DEBUG("\n");
#endif

  uint32_t irqStatus = getIRQStatus();
  if (0 == (RX_SOF_DET_IRQ_STAT & irqStatus)) {
    clearIRQStatus(TX_IRQ_STAT | IDLE_IRQ_STAT);
    return EC_NO_CARD;
  }

  uint8_t responseFlags = (*resultPtr)[0];
  if (responseFlags & (1 << 0)) { // error flag
    uint8_t errorCode = (*resultPtr)[1];

    PN5180DEBUG(F("ERROR code="));
    PN5180DEBUG(formatHex(errorCode));
    PN5180DEBUG(F(" - "));
    PN5180DEBUG(strerror((ISO15693ErrorCode)errorCode));
    PN5180DEBUG("\n");

    if (errorCode >= 0xA0) {
      return ISO15693_EC_CUSTOM_CMD_ERROR;
    }
    return (ISO15693ErrorCode)errorCode;
  }

  clearIRQStatus(RX_SOF_DET_IRQ_STAT | IDLE_IRQ_STAT | TX_IRQ_STAT | RX_IRQ_STAT);
  return ISO15693_EC_OK;
}

const char *PN5180ISO15693::strerror(ISO15693ErrorCode code) {
  switch (code) {
    case EC_NO_CARD:                        return "No card detected!";
    case ISO15693_EC_OK:                    return "OK!";
    case ISO15693_EC_NOT_SUPPORTED:         return "Command is not supported!";
    case ISO15693_EC_NOT_RECOGNIZED:        return "Command is not recognized!";
    case ISO15693_EC_OPTION_NOT_SUPPORTED:  return "Option is not supported!";
    case ISO15693_EC_UNKNOWN_ERROR:         return "Unknown error!";
    case ISO15693_EC_BLOCK_NOT_AVAILABLE:   return "Specified block is not available!";
    case ISO15693_EC_BLOCK_ALREADY_LOCKED:  return "Specified block is already locked!";
    case ISO15693_EC_BLOCK_IS_LOCKED:       return "Specified block is locked and cannot be changed!";
    case ISO15693_EC_BLOCK_NOT_PROGRAMMED:  return "Specified block was not successfully programmed!";
    case ISO15693_EC_BLOCK_NOT_LOCKED:      return "Specified block was not successfully locked!";
    default:
      if ((code >= 0xA0) && (code <= 0xDF)) {
        return "Custom command error code!";
      }
      return "Undefined error code in ISO15693!";
  }
}
