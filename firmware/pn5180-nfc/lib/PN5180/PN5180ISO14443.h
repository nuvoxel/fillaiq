// NAME: PN5180ISO14443.h
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
#ifndef PN5180ISO14443_H
#define PN5180ISO14443_H

#include "PN5180.h"

class PN5180ISO14443 : public PN5180 {

public:
  PN5180ISO14443(uint8_t SSpin, uint8_t BUSYpin, uint8_t RSTpin, SPIClass *spi = &SPI);

  // Setup RF for ISO14443A (load config, turn on RF, clear crypto)
  bool setupRF();

  // Activate Type A card. Returns UID length (4 or 7), 0 on no card, negative on error.
  // buffer must be 10 bytes: [ATQA(2)][SAK(1)][UID(4-7)]
  // kind: 0 = REQA, 1 = WUPA
  int8_t activateTypeA(uint8_t *buffer, uint8_t kind);

  // MIFARE Classic authentication using native PN5180 command (0x0C).
  // keyType: MIFARE_CLASSIC_KEYA (0x60) or MIFARE_CLASSIC_KEYB (0x61)
  // key: 6-byte key, uid: card UID, uidLen: UID length (only first 4 bytes used)
  // Returns true on success.
  // On failure: performs full 5-step cleanup (clear crypto, idle, flush, clear IRQs, wait idle).
  bool mifareAuthenticate(uint8_t blockNo, uint8_t keyType, const uint8_t *key, const uint8_t *uid, uint8_t uidLen = 4);

  // Read 16 bytes from a MIFARE Classic block (must be authenticated first)
  bool mifareBlockRead(uint8_t blockno, uint8_t *buffer);

  // Write 16 bytes to a MIFARE Classic block (must be authenticated first)
  // Returns 0x0A (ACK) on success
  uint8_t mifareBlockWrite16(uint8_t blockno, const uint8_t *buffer);

  // Send HALT command and clear crypto mode
  bool mifareHalt();

  // Read card serial (UID). Returns UID length (4 or 7), 0 on no card.
  // buffer must be at least 10 bytes.
  int8_t readCardSerial(uint8_t *buffer);

  // Quick check if a card is present
  bool isCardPresent();
};

#endif /* PN5180ISO14443_H */
