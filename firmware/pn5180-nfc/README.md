# PN5180-NFC — Complete Arduino Library + RP2040 Coprocessor

A production-ready **NXP PN5180 NFC frontend IC library** for Arduino, with an optional **RP2040 Pico I2C coprocessor** that offloads all NFC operations from your main MCU.

The PN5180 is NXP's most capable NFC frontend — a full NFC Forum-compliant reader/writer supporting all tag types, card emulation, and peer-to-peer. This library makes it usable from Arduino with proper SPI protocol handling, robust error recovery, and thorough documentation.

> **If you've been struggling to get the PN5180 working, read the [Power Supply](#critical-pn5180-power-supply) section first.** Missing 3.3V power is the #1 cause of "SPI works but can't read tags" — and it's been misdiagnosed across dozens of forum posts.

---

## PN5180 Capabilities

The PN5180 (NXP product page: [PN5180](https://www.nxp.com/products/rfid-nfc/nfc-hf/nfc-readers/full-nfc-forum-compliant-frontend-ic:PN5180)) supports:

| Mode | Standards | Status in This Library |
|------|-----------|----------------------|
| Reader/Writer ISO 14443A | ISO/IEC 14443-A up to 848 kbit/s | **Implemented** — MIFARE Classic, NTAG, Ultralight |
| Reader/Writer ISO 14443B | ISO/IEC 14443-B up to 848 kbit/s | Planned |
| Reader/Writer FeliCa | JIS X 6319-4 (FeliCa scheme) | Planned |
| Reader/Writer ISO 15693 | ISO/IEC 15693, ISO/IEC 18000-3 Mode 3 | **Implemented** — ICODE SLIX/SLIX2, multi-tag |
| NFC Peer-to-Peer | ISO/IEC 18092 (NFC-IP1), ISO/IEC 21481 (NFC-IP2) | Planned |
| Card Emulation | ISO/IEC 14443-A up to 848 kbit/s | Planned |
| All NFC Forum Tag Types | Type 1 (Topaz), Type 2 (NTAG), Type 3 (FeliCa), Type 4 (DESFire), Type 5 (ICODE) | Partial (Type 2 + 5) |
| Low Power Card Detection | LPCD with configurable threshold | **Implemented** |

### Currently Supported Tags

| Tag | Protocol | UID | Data | Notes |
|-----|----------|-----|------|-------|
| MIFARE Classic 1K/4K | ISO 14443A | 4 bytes | 16/40 sectors, Crypto1 | Native PN5180 auth (cmd 0x0C) |
| NTAG 213/215/216 | ISO 14443A | 7 bytes | 45/135/231 pages | Page-by-page read |
| MIFARE Ultralight | ISO 14443A | 7 bytes | 16 pages | Same as NTAG path |
| ICODE SLIX / SLIX2 | ISO 15693 | 8 bytes | Variable blocks | Privacy mode, passwords |
| Bambu Lab spool tags | ISO 14443A | 4 bytes | 16 sectors | HKDF-SHA256 key derivation |

### Roadmap

- [ ] ISO 14443B (SRIX, ST25TB, etc.)
- [ ] FeliCa / NFC-F (Sony, transit cards)
- [ ] ISO 14443-4 / DESFire (AES auth, application-based)
- [ ] NFC Forum NDEF message parsing (Type 2 + 5)
- [ ] Card emulation mode (ISO 14443A)
- [ ] NFC-IP1 peer-to-peer (ISO 18092)
- [ ] NFC Cockpit USB passthrough (see [NFC Cockpit Support](#nfc-cockpit-usb-passthrough))
- [ ] Antenna auto-tuning (DPC calibration at EEPROM 0x5C)

---

## Critical: PN5180 Power Supply

> **The PN5180 module requires BOTH 3.3V AND 5V connected.**

| Pin | Voltage | Purpose |
|-----|---------|---------|
| **5V / VCC** | 5V | Antenna driver (TVDD) — powers the RF transmitter |
| **3.3V** | 3.3V | Digital logic (PVDD/VDDA) — powers the PN5180 chip |
| **GND** | GND | Common ground |

### What Happens Without 3.3V?

The PN5180 chip gets parasitic power through the SPI data pin protection diodes. This is enough for SPI register reads, firmware version queries, and EEPROM access — **but not enough for reliable RF operation.**

**Symptoms of missing 3.3V:**
- Firmware version reads correctly (e.g., `fw=4.0 prod=4.0`)
- `setupRF()` sometimes succeeds, sometimes fails
- `activateTypeA()` returns garbage ATQA values or 0x0000
- RF field turns on intermittently (RF_STATUS bit 0 flickers)
- `GENERAL_ERROR_IRQ` (IRQ bit 17) appears frequently
- Tag reads work ~1/300 attempts

**This has been widely misdiagnosed** on Arduino forums, GitHub issues, and NXP community posts as:
- "Bad PN5180 module" / "faulty solder joints"
- "SPI timing issues" / "need longer delays"
- "Breadboard signal integrity"
- "Library bug"

**It's almost always the missing 3.3V.**

### Power Wiring

```
MCU 3.3V out ──── PN5180 3.3V pin
MCU 5V / USB ──── PN5180 5V / VCC pin
MCU GND      ──── PN5180 GND pin
```

On RP2040 Pico: `3V3(OUT)` (pin 36) for 3.3V, `VSYS` (pin 39) for 5V.

---

## Datasheets and References

- **[PN5180 Datasheet (C3/C4, Rev 4.3)](https://www.nxp.com/docs/en/data-sheet/PN5180A0XX_C3_C4.pdf)** — Full IC specification, SPI protocol (section 11.4), register map, electrical characteristics
- **[PN5180 Datasheet (C1/C2)](https://www.nxp.com/docs/en/data-sheet/PN5180A0XX-C1-C2.pdf)** — Earlier silicon revision
- **[AN12650 — Using the PN5180 without library](https://www.nxp.com/docs/en/application-note/AN12650.pdf)** — Bare-metal register-level programming guide
- **[AN11744 — PN5180 Evaluation Board Quick Start](https://www.nxp.com/docs/en/application-note/AN11744.pdf)** — NFC Cockpit setup, antenna tuning
- **[PN5180 Product Page](https://www.nxp.com/products/rfid-nfc/nfc-hf/nfc-readers/full-nfc-forum-compliant-frontend-ic:PN5180)** — Ordering, evaluation boards

### Module Pinout (AITRIP / common breakout)

```
┌─────────────────────────────────────┐
│  PN5180 NFC Module                  │
│                                     │
│  5V  RST  NSS  MOSI  MISO  SCK     │
│  GND IRQ  AUX  REQ   3.3V  (n/c)   │
│                                     │
│  ┌─────────────────────────┐        │
│  │     Antenna Coil        │        │
│  │     (PCB trace)         │        │
│  └─────────────────────────┘        │
└─────────────────────────────────────┘
```

Not all modules break out the 3.3V pin — check your specific board. If there's no 3.3V pin, the module may have an onboard LDO regulator (rare on cheap modules).

---

## Quick Start (Library Only)

For using the PN5180 library directly on any Arduino board (no Pico coprocessor):

1. Copy `lib/PN5180/` into your project's `lib/` directory
2. Wire SPI + BUSY + RST + 3.3V + 5V (see [Wiring](#wiring))

```cpp
#include <SPI.h>
#include <PN5180ISO14443.h>
#include <PN5180ISO15693.h>

// Adjust pins for your board
PN5180ISO14443 reader14443(SS_PIN, BUSY_PIN, RST_PIN, &SPI);
PN5180ISO15693 reader15693(SS_PIN, BUSY_PIN, RST_PIN, &SPI);

void setup() {
    Serial.begin(115200);
    SPI.begin();
    reader14443.begin();

    // Hardware reset
    reader14443.reset();
    delay(100);

    // Setup RF for ISO 14443A
    if (reader14443.setupRF()) {
        Serial.println("PN5180 ready");
    }
}

void loop() {
    uint8_t response[10];
    int8_t uidLen = reader14443.activateTypeA(response, 1);  // WUPA

    if (uidLen == 4) {
        Serial.printf("MIFARE Classic UID: %02X:%02X:%02X:%02X\n",
            response[3], response[4], response[5], response[6]);

        // Authenticate with default key
        uint8_t key[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
        if (reader14443.mifareAuthenticate(0, 0x60, key, response + 3, 4)) {
            uint8_t block[16];
            if (reader14443.mifareBlockRead(0, block)) {
                Serial.println("Block 0 read OK");
            }
        }
        reader14443.mifareHalt();
    } else if (uidLen == 7) {
        Serial.printf("NTAG UID: %02X:%02X:%02X:%02X:%02X:%02X:%02X\n",
            response[3], response[4], response[5], response[6],
            response[7], response[8], response[9]);
    }

    // Also check ISO 15693
    reader15693.setupRF();
    uint8_t uid[8];
    if (reader15693.getInventory(uid) == ISO15693_EC_OK) {
        Serial.printf("ISO15693 UID: %02X:%02X:%02X:%02X:%02X:%02X:%02X:%02X\n",
            uid[7], uid[6], uid[5], uid[4], uid[3], uid[2], uid[1], uid[0]);
    }
    reader14443.setupRF();  // Switch back to 14443A

    delay(250);
}
```

---

## Coprocessor Mode (RP2040 Pico)

The Pico coprocessor handles all NFC autonomously and exposes tag data to your host MCU over I2C.

### Why?

- **Frees 6 host pins** — SPI (SCK, MOSI, MISO, NSS) + BUSY + RST become 2 shared I2C + 1 INT
- **Interrupt-driven** — INT pin goes LOW when tag data is ready. No polling.
- **Protocol-transparent** — Pico handles 14443A / 15693 mode switching internally
- **Isolated SPI** — NFC traffic doesn't affect your host's SPI bus
- **Autonomous scanning** — Pico polls continuously, host reads when convenient

### Wiring

#### Pico to PN5180

| Signal | Pico GPIO | PN5180 Pin | Notes |
|--------|-----------|------------|-------|
| SCK | GP2 | SCK | SPI0 clock |
| MOSI | GP3 | MOSI | SPI0 TX |
| MISO | GP4 | MISO | SPI0 RX |
| NSS | GP5 | NSS | Chip select |
| BUSY | GP6 | BUSY | Status input |
| RST | GP7 | RST | Reset output |
| IRQ | GP8 | IRQ | LPCD wake (optional) |
| 3V3 | 3V3(OUT) | 3.3V | **Required** |
| 5V | VSYS | 5V/VCC | Antenna power |
| GND | GND | GND | Common |

#### Pico to Host MCU

| Signal | Pico GPIO | Host | Notes |
|--------|-----------|------|-------|
| SDA | GP0 | I2C SDA | Shared bus, 400 kHz |
| SCL | GP1 | I2C SCL | Shared bus |
| INT | GP9 | Any GPIO | Active LOW = data ready |
| GND | GND | GND | Common ground |

Power the Pico from the host's 5V rail via VSYS.

### Schematic

```
                    ┌──────────┐
  Host MCU          │  RP2040  │          PN5180 Module
  ────────          │  Pico    │          ─────────────
                    │          │
  I2C SDA ──────── GP0    GP2 ──── SCK ────── SCK
  I2C SCL ──────── GP1    GP3 ──── MOSI ───── MOSI
  INT GPIO ─────── GP9    GP4 ──── MISO ───── MISO
                    │      GP5 ──── NSS ────── NSS
                    │      GP6 ──── BUSY ───── BUSY
                    │      GP7 ──── RST ────── RST
                    │      GP8 ──── IRQ ────── IRQ
                    │          │
  5V ──────┬─────── VSYS   3V3(OUT) ──────── 3.3V
           │        │                          │
           └────────┼──────────────────────── 5V/VCC
                    │                          │
  GND ──────────── GND ──────────────────── GND
```

### Building

Requires [PlatformIO](https://platformio.org/).

```bash
cd firmware/nfc-pico
pio run -e nfc_pico              # Build
pio run -e nfc_pico -t upload    # Flash via USB
```

Or hold BOOTSEL, plug USB, drag `.pio/build/nfc_pico/firmware.uf2`.

### I2C Register Map

**I2C Address: 0x55** | 400 kHz fast mode

| Reg | Name | R/W | Description |
|-----|------|-----|-------------|
| 0x00 | STATUS | R | Bit 0: tag present, 1: data ready, 2: reader OK, 3: reading |
| 0x01 | TAG_TYPE | R | 0=none, 1=MIFARE Classic, 2=NTAG, 3=ISO 15693 |
| 0x02 | UID_LEN | R | 4, 7, or 8 |
| 0x03-0A | UID | R | Tag UID (zero-padded to 8 bytes) |
| 0x0B | SECTORS_READ | R | MIFARE sectors successfully read (0-16) |
| 0x0C | PAGES_READ | R | NTAG/ISO15693 pages read |
| 0x0D-0E | SECTOR_OK | R | Per-sector success bitmask (H, L) |
| 0x10-11 | DATA_LEN | R | Data buffer length (big-endian) |
| 0x20-21 | DATA_PTR | W | Set read cursor (big-endian, write H then L) |
| 0x30 | DATA | R | Read data byte (auto-increments cursor) |
| 0xE0 | CMD | W | 0x01=rescan, 0x02=reset, 0x03=ack |
| 0xFE | FW_VERSION | R | Firmware version |
| 0xFF | DEVICE_ID | R | Always 0x55 |

#### Reading Tag Data from Host

```
1. Wait for INT pin LOW (or poll STATUS register bit 1)
2. Read TAG_TYPE, UID_LEN, UID registers
3. Read DATA_LEN (2 bytes, big-endian)
4. Write DATA_PTR = 0x0000 (set cursor to start)
5. Read DATA register N times (auto-increments)
6. Write CMD = 0x03 (ACK — releases INT pin)
```

#### Data Buffer Layout

- **MIFARE Classic:** 768 bytes — `[sector0_block0(16)] [sector0_block1(16)] [sector0_block2(16)] [sector1_block0(16)] ...`
- **NTAG:** `pages_read * 4` bytes — sequential 4-byte pages
- **ISO 15693:** `pages_read * blockSize` bytes — sequential blocks

### Host-Side Arduino Example

```cpp
#include <Wire.h>

#define NFC_ADDR 0x55
#define INT_PIN  21

uint8_t readReg(uint8_t reg) {
    Wire.beginTransmission(NFC_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)NFC_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0xFF;
}

void setup() {
    Wire.begin();
    pinMode(INT_PIN, INPUT_PULLUP);
}

void loop() {
    if (digitalRead(INT_PIN) == LOW) {
        uint8_t tagType = readReg(0x01);
        uint8_t uidLen = readReg(0x02);

        uint8_t uid[8];
        Wire.beginTransmission(NFC_ADDR);
        Wire.write(0x03);  // UID register
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)NFC_ADDR, uidLen);
        for (int i = 0; i < uidLen; i++) uid[i] = Wire.read();

        Serial.printf("Tag type=%d UID=", tagType);
        for (int i = 0; i < uidLen; i++) Serial.printf("%02X:", uid[i]);
        Serial.println();

        // ACK — release INT
        Wire.beginTransmission(NFC_ADDR);
        Wire.write(0xE0);
        Wire.write(0x03);
        Wire.endTransmission();
    }
    delay(50);
}
```

---

## Known PN5180 Modules and Dev Boards

| Module | 3.3V Pin? | Antenna | Notes |
|--------|-----------|---------|-------|
| **NXP PNEV5180B** (OM25180FDK) | Yes (onboard LDO) | 65x65mm + 30x50mm included | Official eval kit, $190. NFC Cockpit compatible. Includes DPC tuning, matching PCBs, NTAG216F sample card. |
| **AITRIP/Blue Generic PN5180** | **Check your board** — some have 3.3V pad, some don't | ~40x25mm PCB trace antenna | Most common cheap module on Amazon/AliExpress. 11-pin header: 5V, RST, NSS, MOSI, MISO, SCK, BUSY, GND, IRQ, AUX, REQ. **Verify 3.3V pin exists and connect it.** |
| **[Elechouse PN5180](https://www.elechouse.com/product/pn5180-nfc-module/)** | Yes | ~45x45mm PCB antenna | Physical footprint of the popular elechouse PN532 board. Similar quality|
> **If your module has no 3.3V pin**, it likely has an onboard LDO regulator and only needs 5V. Verify by measuring 3.3V on the PN5180 IC's PVDD pins with a multimeter while 5V is connected. If PVDD reads 0V or < 3V, you need external 3.3V.

---

## Antenna Design

The PN5180 antenna design is covered in detail by NXP's **AN11740 — PN5180 Antenna Design Guide** (62 pages):

- **[AN11740 PDF](https://www.nxp.com/docs/en/application-note/AN11740.pdf)** — Standard and DPC antenna design, matching circuits, tuning procedures, EMVCo compliance

### Key Antenna Specs

- **Frequency:** 13.56 MHz (ISM band)
- **Typical reader coil:** 3-5 turns, PCB trace or wire-wound
- **Coil sizes:** 10 mm^2 (implant readers) to 200 mm diameter (access control)
- **Matching circuit:** LC network tuned to 13.56 MHz resonance
- **EMVCo operating volume:** 50mm wide x 30mm deep (see AN11740 Fig 6)

### Matching Circuit

The antenna coil connects to the PN5180's TX1/TX2 and RX pins through a matching network. The standard "asymmetrical" tuning uses:

```
TX1 ──┬── C_series ──┬── Antenna Coil ──┬── C_series ── TX2
      │              │                   │
      C_par         (L_coil)            C_par
      │              │                   │
     GND            GND                 GND
                     │
                  C_RX ── RX pin
```

Component values depend on your antenna coil's inductance. Use NFC Cockpit or a VNA to measure and tune.

### Custom Antenna Resources

- **[NXP AN11740](https://www.nxp.com/docs/en/application-note/AN11740.pdf)** — Official antenna design guide
- **[DIY HF Antenna for PN5180](https://forum.dangerousthings.com/t/diy-hf-antenna-for-pn5180/16970)** — Community discussion on custom coil design, air-core vs PCB, and matching circuit values
- **[PN5180 Explained — EasyElecModule](https://easyelecmodule.com/pn5180-explained-the-ultimate-nfc-module-with-full-protocol-compatibility/)** — Comprehensive overview of PN5180 capabilities, protocol support, and module comparison
- **[NXP NFC Antenna Design Tool](https://www.nxp.com/design/design-center/software/development-software/nfc-cockpit:NFC-COCKPIT)** — NFC Cockpit includes antenna tuning features

### Tips for PCB Antenna Layout

- Keep antenna traces **away from ground plane** (cut ground plane under the coil)
- Use **2-layer or 4-layer** PCB with coil on top layer, ground plane on bottom
- Minimum trace width: 0.3mm for small coils, 0.5-1mm for standard coils
- Route SPI traces **away from the antenna coil** to avoid RF coupling
- Place matching capacitors **as close to PN5180 as possible**
- Connect antenna GND to a **single star-ground point** near the IC

---

## NFC Cockpit USB Passthrough

**Status: Planned**

[NXP NFC Cockpit](https://www.nxp.com/design/design-center/development-boards-and-designs/nfc-cockpit-configuration-tool-for-nfc-ics:NFC-COCKPIT) is NXP's official configuration and testing tool for PN5180. It communicates over USB using a specific command protocol.

Since the Pico has USB, it may be possible to implement a **USB passthrough mode** that lets NFC Cockpit talk directly to the PN5180 through the Pico's USB port. This would enable:

- Antenna tuning via NFC Cockpit's built-in tools
- Protocol debugging and analysis
- EEPROM configuration
- RF field strength measurement

This is not yet implemented. Contributions welcome.

---

## SPI Protocol Reference

The PN5180 uses a custom half-duplex SPI protocol extended with a BUSY handshake pin (datasheet section 11.4).

### Transaction Sequence

```
 Host                                    PN5180
  │                                        │
  │  ── Wait BUSY LOW ──────────────────►  │  (device ready)
  │  ── Assert NSS LOW ─────────────────►  │
  │  ── SPI clock out command ──────────►  │
  │  ◄── BUSY goes HIGH ───────────────── │  (processing)
  │  ── Deassert NSS HIGH ─────────────►  │
  │  ◄── BUSY goes LOW ────────────────── │  (done)
  │                                        │
  │  If response expected:                 │
  │  ── Assert NSS LOW ─────────────────►  │
  │  ◄── SPI clock in response ─────────  │
  │  ◄── BUSY goes HIGH ───────────────── │
  │  ── Deassert NSS HIGH ─────────────►  │
  │  ◄── BUSY goes LOW ────────────────── │
```

- **SPI Mode:** CPOL=0, CPHA=0 (Mode 0), MSB first
- **Max clock:** 7 MHz
- **NSS setup time:** 72 ns minimum (datasheet). Libraries typically use 1-2ms for safety on breadboard wiring; 1µs is fine on PCB.
- **NSS must be manual GPIO** — not hardware SPI CS, because it must stay asserted across BUSY transitions

### Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| BUSY stuck HIGH | Interrupted SPI transaction | Hardware reset via RST pin |
| Register reads return 0xFF | MISO not connected, or 3.3V missing | Check wiring + power |
| Writes succeed but reads fail | NSS deassert timing | Add 1ms after NSS HIGH |
| `Arduino SPI.transfer(buf, len)` corrupts data | Overwrites send buffer with received data | Use byte-at-a-time loop on RP2040 |

---

## PN5180 Register Quick Reference

| Register | Address | Key Bits |
|----------|---------|----------|
| SYSTEM_CONFIG | 0x00 | Bits 0-2: transceive command, Bit 6: MFC_CRYPTO_ON |
| IRQ_ENABLE | 0x01 | Enable specific interrupts |
| IRQ_STATUS | 0x02 | Bit 0: RX_IRQ, 1: TX_IRQ, 2: IDLE, 14: RX_SOF, 17: GENERAL_ERROR, 19: LPCD |
| IRQ_CLEAR | 0x03 | Write to clear IRQ flags |
| RX_STATUS | 0x13 | Bits 0-8: bytes received, 16: integrity error, 17: protocol error, 18: collision |
| RF_STATUS | 0x1D | Bit 0: RF field active, Bits 24-26: transceiver state |
| CRC_RX_CONFIG | 0x12 | Bit 0: RX CRC enable |
| CRC_TX_CONFIG | 0x19 | Bit 0: TX CRC enable |

### EEPROM Addresses

| Address | Name | Notes |
|---------|------|-------|
| 0x10 | PRODUCT_VERSION | 2 bytes |
| 0x12 | FIRMWARE_VERSION | 2 bytes |
| 0x34 | LPCD_REFERENCE_VALUE | LPCD calibration reference |
| 0x36 | LPCD_FIELD_ON_TIME | RF pulse duration for LPCD |
| 0x37 | LPCD_THRESHOLD | Detection sensitivity |
| 0x38 | LPCD_REFVAL_GPO_CONTROL | LPCD mode (0x01 = self-calibration) |
| 0x5C | DPC_XI | Digital Phase Calibration (antenna tuning) |

### RF Configuration Indices (LOAD_RF_CONFIG command 0x11)

| Protocol | TX Config | RX Config | Notes |
|----------|-----------|-----------|-------|
| ISO 14443A 106 kbps | 0x00 | 0x80 | MIFARE, NTAG, Ultralight |
| ISO 14443A 212 kbps | 0x01 | 0x81 | Higher speed, if tag supports |
| ISO 14443A 424 kbps | 0x02 | 0x82 | |
| ISO 14443A 848 kbps | 0x03 | 0x83 | |
| ISO 14443B 106 kbps | 0x04 | 0x84 | SRIX, ST25TB |
| ISO 14443B 212 kbps | 0x05 | 0x85 | |
| ISO 14443B 424 kbps | 0x06 | 0x86 | |
| ISO 14443B 848 kbps | 0x07 | 0x87 | |
| FeliCa 212 kbps | 0x08 | 0x88 | JIS X 6319-4 |
| FeliCa 424 kbps | 0x09 | 0x89 | |
| ISO 15693 ASK100 26 kbps | 0x0D | 0x8D | ICODE SLIX, single subcarrier |
| ISO 15693 ASK10 26 kbps | 0x0E | 0x8E | Dual subcarrier |
| ISO 18092 212 kbps | 0x0A | 0x8A | NFC-IP1 active |
| ISO 18092 424 kbps | 0x0B | 0x8B | NFC-IP1 active |

### MIFARE Authentication Notes

The PN5180 has a **native MIFARE Classic authentication command** (0x0C) that uses the chip's built-in Crypto1 engine. This is more reliable than software crypto implementations:

```
Command: [0x0C][Key(6 bytes)][KeyType(1)][BlockNo(1)][UID(4 bytes)]
Response: 1 byte (0x00 = success)
KeyType: 0x60 = Key A, 0x61 = Key B
```

After authentication failure, the chip requires a **5-step cleanup** (jef-sure pattern):
1. Clear MFC_CRYPTO_ON bit (SYSTEM_CONFIG bit 6)
2. Set transceiver to idle (clear SYSTEM_CONFIG bits 0-2)
3. Flush RX buffer
4. Clear all IRQ flags
5. Wait for transceiver idle state

---

## Credits and Attribution

This library combines and improves upon the work of several open-source contributors:

- **[Andreas Trappmann](https://github.com/ATrappmann/PN5180-Library)** (2018) — Original PN5180 Arduino library. Established the SPI protocol implementation with BUSY handshake, register/EEPROM access, and library architecture.

- **[Dirk Carstensen (tueddy)](https://github.com/tueddy/PN5180-Library)** (2019) — Extended with ISO 14443A full anticollision and select supporting 4-byte and 7-byte UIDs, MIFARE Classic block read/write with CRC handling, and multi-tag ISO 15693 inventory with 16-slot collision resolution.

- **[jef-sure](https://components.espressif.com/components/jef-sure/pn5180)** (2024) — ESP-IDF component introducing robust error recovery patterns: 5-step MIFARE authentication cleanup, escalating hardware reset retries with backoff, and dual IRQ + RF_STATUS register verification for reliable RF field activation.

- **[NXP Semiconductors](https://www.nxp.com/products/rfid-nfc/nfc-hf/nfc-readers/full-nfc-forum-compliant-frontend-ic:PN5180)** — PN5180 hardware, datasheet, application notes, and NFC Cockpit toolkit.

- **[Filla IQ](https://www.fillaiq.com)** ([GitHub](https://github.com/nuvoxel/fillaiq)) (2025-2026) — Combined best-of-breed library rewrite, RP2040 Pico coprocessor firmware and I2C bridge protocol, BearSSL HKDF-SHA256 key derivation for Bambu Lab tags, 3.3V power supply diagnosis, and this documentation. Part of the [Filla IQ](https://www.fillaiq.com) smart workshop inventory system.

## License

- `lib/PN5180/` — **LGPL-2.1+** (consistent with original works, see file headers for individual copyrights)
- `src/`, `include/` — **MIT**

```
MIT License — Copyright (c) 2025-2026 Filla IQ

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| FW version reads OK, no tags detected | Missing 3.3V power | Connect 3.3V to PN5180 3.3V pin |
| ATQA always 0x0000 | No tag present, or RF not on | Verify `setupRF()` returns true |
| ATQA is 0xFFFF | MISO stuck high | Check 3.3V power + MISO wiring |
| BUSY stuck HIGH after reset | PN5180 firmware hang | Full power cycle (not just RST) |
| `mifareAuthenticate` fails | Wrong key or corrupted UID | Verify UID matches, try default key FF×6 |
| RF_ON succeeds but tag read fails | Antenna not connected/damaged | Inspect solder joints on antenna pads |
| Works intermittently on breadboard | Long SPI wires at 7MHz | Reduce to 1MHz, or shorten wires |
| `GENERAL_ERROR_IRQ` constant | Power supply issue or SPI desync | Power cycle, verify 3.3V + 5V |
| ESP32 I2C `Unfinished Repeated Start` | I2C transaction timing | Minor — doesn't affect reads |
