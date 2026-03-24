// NAME: PN5180.h
//
// DESC: NFC Communication with NXP Semiconductors PN5180 module for Arduino.
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
#ifndef PN5180_H
#define PN5180_H

#include <SPI.h>

// PN5180 Registers
#define SYSTEM_CONFIG       (0x00)
#define IRQ_ENABLE          (0x01)
#define IRQ_STATUS          (0x02)
#define IRQ_CLEAR           (0x03)
#define TRANSCEIVE_CONTROL  (0x04)
#define TIMER1_RELOAD       (0x0c)
#define TIMER1_CONFIG       (0x0f)
#define RX_WAIT_CONFIG      (0x11)
#define CRC_RX_CONFIG       (0x12)
#define RX_STATUS           (0x13)
#define TX_WAIT_CONFIG      (0x17)
#define TX_CONFIG           (0x18)
#define CRC_TX_CONFIG       (0x19)
#define SIGPRO_RM_CONFIG    (0x1C)
#define RF_STATUS           (0x1d)
#define SYSTEM_STATUS       (0x24)
#define TEMP_CONTROL        (0x25)
#define AGC_REF_CONFIG      (0x26)

// SYSTEM_CONFIG bit masks
#define MFC_CRYPTO_ON                    (1 << 6)   // MIFARE Crypto1 enabled
#define SYSTEM_CONFIG_CLEAR_CRYPTO_MASK  0xFFFFFFBF  // ~(1<<6)

// PN5180 EEPROM Addresses
#define DIE_IDENTIFIER      (0x00)
#define PRODUCT_VERSION     (0x10)
#define FIRMWARE_VERSION    (0x12)
#define EEPROM_VERSION      (0x14)
#define IRQ_PIN_CONFIG      (0x1A)

// PN5180 EEPROM Addresses - LPCD
#define DPC_XI                          (0x5C)
#define LPCD_REFERENCE_VALUE            (0x34)
#define LPCD_FIELD_ON_TIME              (0x36)
#define LPCD_THRESHOLD                  (0x37)
#define LPCD_REFVAL_GPO_CONTROL         (0x38)
#define LPCD_GPO_TOGGLE_BEFORE_FIELD_ON (0x39)
#define LPCD_GPO_TOGGLE_AFTER_FIELD_ON  (0x3A)

enum PN5180TransceiveStat {
  PN5180_TS_Idle = 0,
  PN5180_TS_WaitTransmit = 1,
  PN5180_TS_Transmitting = 2,
  PN5180_TS_WaitReceive = 3,
  PN5180_TS_WaitForData = 4,
  PN5180_TS_Receiving = 5,
  PN5180_TS_LoopBack = 6,
  PN5180_TS_RESERVED = 7
};

// PN5180 IRQ_STATUS
#define RX_IRQ_STAT                  (1<<0)   // End of RF reception IRQ
#define TX_IRQ_STAT                  (1<<1)   // End of RF transmission IRQ
#define IDLE_IRQ_STAT                (1<<2)   // IDLE IRQ
#define MODE_DETECTED_IRQ_STAT       (1<<3)   // Mode detected IRQ
#define CARD_ACTIVATED_IRQ_STAT      (1<<4)   // Card activated IRQ
#define STATE_CHANGE_IRQ_STAT        (1<<5)   // State change IRQ
#define RFOFF_DET_IRQ_STAT           (1<<6)   // RF Field OFF detection IRQ
#define RFON_DET_IRQ_STAT            (1<<7)   // RF Field ON detection IRQ
#define TX_RFOFF_IRQ_STAT            (1<<8)   // RF Field OFF in PCD IRQ
#define TX_RFON_IRQ_STAT             (1<<9)   // RF Field ON in PCD IRQ
#define RF_ACTIVE_ERROR_IRQ_STAT     (1<<10)  // RF Active error IRQ
#define TIMER0_IRQ_STAT              (1<<11)  // Timer 0 IRQ
#define TIMER1_IRQ_STAT              (1<<12)  // Timer 1 IRQ
#define TIMER2_IRQ_STAT              (1<<13)  // RX Timeout IRQ
#define RX_SOF_DET_IRQ_STAT          (1<<14)  // RF SOF Detection IRQ
#define RX_SC_DET_IRQ_STAT           (1<<15)  // RF SCD Detection IRQ
#define TEMPSENS_ERROR_IRQ_STAT      (1<<16)  // Temperature Sensor Error IRQ
#define GENERAL_ERROR_IRQ_STAT       (1<<17)  // General error IRQ
#define HV_ERROR_IRQ_STAT            (1<<18)  // High Voltage error IRQ
#define LPCD_IRQ_STAT                (1<<19)  // LPCD Detection IRQ

// RX_STATUS register masks
#define RX_BYTES_RECEIVED_MASK       0x1FF
#define RX_NUM_FRAMES_RECEIVED_START 9
#define RX_NUM_FRAMES_RECEIVED_MASK  0x0F
#define RX_DATA_INTEGRITY_ERROR      (1<<16)
#define RX_PROTOCOL_ERROR            (1<<17)
#define RX_COLLISION_DETECTED        (1<<18)

// RF_STATUS AGC mask
#define RF_STATUS_AGC_MASK           0x000003FFu

// MIFARE Classic key types
#define MIFARE_CLASSIC_KEYA          0x60
#define MIFARE_CLASSIC_KEYB          0x61

class PN5180 {
private:
  uint8_t PN5180_NSS;    // active low
  uint8_t PN5180_BUSY;
  uint8_t PN5180_RST;    // 0xFF = no RST pin

  SPIClass *PN5180_SPI;
  SPISettings PN5180_SPI_SETTINGS;
  bool _rfOn;

  static uint8_t readBuffer[508];

public:
  uint16_t commandTimeout;  // ms, default 200

  PN5180(uint8_t SSpin, uint8_t BUSYpin, uint8_t RSTpin, SPIClass *spi = &SPI);

  void begin();
  void end();

  // PN5180 direct commands with host interface
public:
  /* cmd 0x00 */
  bool writeRegister(uint8_t reg, uint32_t value);
  /* cmd 0x01 */
  bool writeRegisterWithOrMask(uint8_t addr, uint32_t mask);
  /* cmd 0x02 */
  bool writeRegisterWithAndMask(uint8_t addr, uint32_t mask);
  /* cmd 0x04 */
  bool readRegister(uint8_t reg, uint32_t *value);
  /* cmd 0x06 */
  bool writeEEprom(uint8_t addr, const uint8_t *buffer, uint8_t len);
  /* cmd 0x07 */
  bool readEEprom(uint8_t addr, uint8_t *buffer, int len);
  /* cmd 0x09 */
  bool sendData(const uint8_t *data, int len, uint8_t validBits = 0);
  /* cmd 0x0a */
  uint8_t * readData(int len);
  bool readData(int len, uint8_t *buffer);
  /* prepare LPCD registers */
  bool prepareLPCD();
  /* cmd 0x0B */
  bool switchToLPCD(uint16_t wakeupCounterInMs);
  /* cmd 0x0C - native PN5180 MIFARE_AUTHENTICATE */
  int16_t mifareAuthenticate(uint8_t blockNo, const uint8_t *key, uint8_t keyType, const uint8_t *uid);
  /* cmd 0x11 */
  bool loadRFConfig(uint8_t txConf, uint8_t rxConf);
  /* cmd 0x16 */
  bool setRF_on();
  /* cmd 0x17 */
  bool setRF_off();

  bool sendCommand(uint8_t *sendBuffer, size_t sendBufferLen, uint8_t *recvBuffer, size_t recvBufferLen);

  // Helper functions
public:
  bool reset();
  bool isReady();

  uint32_t getIRQStatus();
  bool clearIRQStatus(uint32_t irqMask);

  PN5180TransceiveStat getTransceiveState();
  uint32_t rxBytesReceived();

private:
  bool transceiveCommand(uint8_t *sendBuffer, size_t sendBufferLen, uint8_t *recvBuffer = 0, size_t recvBufferLen = 0);
  bool waitBusy(int level, unsigned long timeoutMs);
  void mifareAuthCleanup();
};

#endif /* PN5180_H */
