#include "usb_printer.h"
#include "scan_config.h"
#include "usb/usb_host.h"
#include "usb/usb_types_ch9.h"

// ── State ───────────────────────────────────────────────────────────────────

static usb_host_client_handle_t sClientHdl = NULL;
static usb_device_handle_t sDevHdl = NULL;
static uint8_t sBulkOutEp = 0;
static uint16_t sBulkOutMps = 0;
static uint8_t sIfaceNum = 0xFF;
static volatile bool sReady = false;
static bool sInstalled = false;
static SemaphoreHandle_t sXferSem = NULL;

// Device info strings
static uint16_t sVid = 0;
static uint16_t sPid = 0;
static char sManufacturer[64] = {0};
static char sProduct[64] = {0};
static char sSerialStr[64] = {0};

// ── Transfer callback ───────────────────────────────────────────────────────

static void xferCallback(usb_transfer_t* transfer) {
    if (transfer->status != USB_TRANSFER_STATUS_COMPLETED) {
        Serial.printf("[USB] Transfer failed: status %d\n", transfer->status);
    }
    xSemaphoreGive(sXferSem);
}

// ── Read string descriptor ──────────────────────────────────────────────────

static void readStringDescriptor(uint8_t index, char* out, size_t outLen) {
    if (!sDevHdl || index == 0) return;

    // Allocate a transfer for control request
    usb_transfer_t* xfer;
    if (usb_host_transfer_alloc(256, 0, &xfer) != ESP_OK) return;

    // Build GET_DESCRIPTOR control request for string
    xfer->num_bytes = 256;
    xfer->device_handle = sDevHdl;
    xfer->bEndpointAddress = 0;
    xfer->callback = xferCallback;
    xfer->timeout_ms = 1000;

    usb_setup_packet_t* setup = (usb_setup_packet_t*)xfer->data_buffer;
    setup->bmRequestType = USB_BM_REQUEST_TYPE_DIR_IN |
                           USB_BM_REQUEST_TYPE_TYPE_STANDARD |
                           USB_BM_REQUEST_TYPE_RECIP_DEVICE;
    setup->bRequest = USB_B_REQUEST_GET_DESCRIPTOR;
    setup->wValue = (USB_W_VALUE_DT_STRING << 8) | index;
    setup->wIndex = 0x0409;  // English
    setup->wLength = 256 - sizeof(usb_setup_packet_t);

    if (usb_host_transfer_submit_control(sClientHdl, xfer) != ESP_OK) {
        usb_host_transfer_free(xfer);
        return;
    }

    if (xSemaphoreTake(sXferSem, pdMS_TO_TICKS(2000)) != pdTRUE) {
        usb_host_transfer_free(xfer);
        return;
    }

    if (xfer->status == USB_TRANSFER_STATUS_COMPLETED && xfer->actual_num_bytes > 2) {
        // String descriptor: byte[0]=length, byte[1]=type, bytes[2..]=UTF-16LE
        uint8_t* desc = xfer->data_buffer + sizeof(usb_setup_packet_t);
        int strLen = (desc[0] - 2) / 2;
        if (strLen > 0 && (size_t)strLen < outLen) {
            for (int i = 0; i < strLen; i++) {
                out[i] = (char)desc[2 + i * 2];  // ASCII from UTF-16LE
            }
            out[strLen] = '\0';
        }
    }

    usb_host_transfer_free(xfer);
}

// ── Client event callback ───────────────────────────────────────────────────

static void clientEventCb(const usb_host_client_event_msg_t* msg, void* arg) {
    switch (msg->event) {
        case USB_HOST_CLIENT_EVENT_NEW_DEV: {
            uint8_t addr = msg->new_dev.address;
            Serial.printf("[USB] New device, address %d\n", addr);

            esp_err_t err = usb_host_device_open(sClientHdl, addr, &sDevHdl);
            if (err != ESP_OK) {
                Serial.printf("[USB] Open failed: %s\n", esp_err_to_name(err));
                return;
            }

            // Check VID/PID
            const usb_device_desc_t* devDesc;
            usb_host_get_device_descriptor(sDevHdl, &devDesc);
            sVid = devDesc->idVendor;
            sPid = devDesc->idProduct;
            Serial.printf("[USB] VID=0x%04X PID=0x%04X Class=%d\n",
                          sVid, sPid, devDesc->bDeviceClass);

            // Read string descriptors
            readStringDescriptor(devDesc->iManufacturer, sManufacturer, sizeof(sManufacturer));
            readStringDescriptor(devDesc->iProduct, sProduct, sizeof(sProduct));
            readStringDescriptor(devDesc->iSerialNumber, sSerialStr, sizeof(sSerialStr));

            if (sManufacturer[0]) Serial.printf("[USB] Manufacturer: %s\n", sManufacturer);
            if (sProduct[0]) Serial.printf("[USB] Product: %s\n", sProduct);
            if (sSerialStr[0]) Serial.printf("[USB] Serial: %s\n", sSerialStr);

            // Get config descriptor and find Bulk OUT endpoint
            const usb_config_desc_t* cfgDesc;
            usb_host_get_active_config_descriptor(sDevHdl, &cfgDesc);

            const uint8_t* p = (const uint8_t*)cfgDesc;
            int totalLen = cfgDesc->wTotalLength;
            int offset = 0;
            uint8_t targetIface = 0xFF;

            while (offset < totalLen) {
                const usb_standard_desc_t* d = (const usb_standard_desc_t*)(p + offset);

                if (d->bDescriptorType == USB_B_DESCRIPTOR_TYPE_INTERFACE) {
                    const usb_intf_desc_t* intf = (const usb_intf_desc_t*)(p + offset);
                    Serial.printf("[USB] Interface %d: class=%d sub=%d proto=%d\n",
                                  intf->bInterfaceNumber, intf->bInterfaceClass,
                                  intf->bInterfaceSubClass, intf->bInterfaceProtocol);
                    // USB Printer class (7) or vendor-specific (0xFF)
                    if (intf->bInterfaceClass == 7 || intf->bInterfaceClass == 0xFF) {
                        targetIface = intf->bInterfaceNumber;
                    }
                }

                if (d->bDescriptorType == USB_B_DESCRIPTOR_TYPE_ENDPOINT && targetIface != 0xFF) {
                    const usb_ep_desc_t* ep = (const usb_ep_desc_t*)(p + offset);
                    uint8_t epType = ep->bmAttributes & 0x03;
                    bool isOut = (ep->bEndpointAddress & 0x80) == 0;

                    Serial.printf("[USB]   EP 0x%02X type=%d mps=%d %s\n",
                                  ep->bEndpointAddress, epType, ep->wMaxPacketSize,
                                  isOut ? "OUT" : "IN");

                    if (epType == USB_BM_ATTRIBUTES_XFER_BULK && isOut) {
                        sBulkOutEp = ep->bEndpointAddress;
                        sBulkOutMps = ep->wMaxPacketSize;
                    }
                }
                offset += d->bLength;
            }

            if (sBulkOutEp == 0) {
                Serial.println("[USB] No Bulk OUT endpoint found");
                usb_host_device_close(sClientHdl, sDevHdl);
                sDevHdl = NULL;
                return;
            }

            // Claim interface
            sIfaceNum = targetIface;
            err = usb_host_interface_claim(sClientHdl, sDevHdl, sIfaceNum, 0);
            if (err != ESP_OK) {
                Serial.printf("[USB] Claim interface failed: %s\n", esp_err_to_name(err));
                usb_host_device_close(sClientHdl, sDevHdl);
                sDevHdl = NULL;
                return;
            }

            sReady = true;
            Serial.printf("[USB] Printer ready — EP 0x%02X MPS %d\n", sBulkOutEp, sBulkOutMps);
            break;
        }

        case USB_HOST_CLIENT_EVENT_DEV_GONE: {
            Serial.println("[USB] Device disconnected");
            sReady = false;
            if (sDevHdl) {
                if (sIfaceNum != 0xFF) {
                    usb_host_interface_release(sClientHdl, sDevHdl, sIfaceNum);
                    sIfaceNum = 0xFF;
                }
                usb_host_device_close(sClientHdl, sDevHdl);
                sDevHdl = NULL;
            }
            sBulkOutEp = 0;
            sManufacturer[0] = '\0';
            sProduct[0] = '\0';
            sSerialStr[0] = '\0';
            break;
        }
    }
}

// ── USB Host daemon task ────────────────────────────────────────────────────

static void usbHostTask(void* arg) {
    while (true) {
        usb_host_lib_handle_events(portMAX_DELAY, NULL);
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

void usbPrinterBegin() {
    if (sInstalled) return;

    sXferSem = xSemaphoreCreateBinary();

    Serial.println("[USB] Installing USB Host Library...");
    usb_host_config_t hostCfg = {
        .skip_phy_setup = false,
        .intr_flags = ESP_INTR_FLAG_LEVEL1,
    };
    esp_err_t err = usb_host_install(&hostCfg);
    if (err != ESP_OK) {
        Serial.printf("[USB] Host install FAILED: %s (0x%x)\n", esp_err_to_name(err), err);
        return;
    }
    Serial.println("[USB] Host library installed OK");

    // Daemon task for low-level USB events
    xTaskCreatePinnedToCore(usbHostTask, "usb_host", 4096, NULL, 2, NULL, 0);

    // Register client
    usb_host_client_config_t clientCfg = {
        .is_synchronous = false,
        .max_num_event_msg = 5,
        .async = {
            .client_event_callback = clientEventCb,
            .callback_arg = NULL,
        },
    };
    err = usb_host_client_register(&clientCfg, &sClientHdl);
    if (err != ESP_OK) {
        Serial.printf("[USB] Client register failed: %s\n", esp_err_to_name(err));
        return;
    }

    sInstalled = true;
    Serial.println("[USB] Host initialized, waiting for device...");
}

void usbPrinterLoop() {
    if (!sInstalled || !sClientHdl) return;
    usb_host_client_handle_events(sClientHdl, 0);  // Non-blocking
}

bool usbPrinterReady() {
    return sReady;
}

bool usbPrinterSend(const uint8_t* data, size_t len, uint32_t timeoutMs) {
    if (!sReady || !sDevHdl) return false;

    // Send in chunks up to 4KB (transfer alloc limit)
    const size_t chunkSize = 4096;
    size_t offset = 0;

    while (offset < len) {
        size_t thisChunk = min(chunkSize, len - offset);

        usb_transfer_t* xfer;
        if (usb_host_transfer_alloc(thisChunk, 0, &xfer) != ESP_OK) {
            Serial.println("[USB] Transfer alloc failed");
            return false;
        }

        memcpy(xfer->data_buffer, data + offset, thisChunk);
        xfer->num_bytes = thisChunk;
        xfer->device_handle = sDevHdl;
        xfer->bEndpointAddress = sBulkOutEp;
        xfer->callback = xferCallback;
        xfer->timeout_ms = timeoutMs;

        esp_err_t err = usb_host_transfer_submit(xfer);
        if (err != ESP_OK) {
            Serial.printf("[USB] Submit failed: %s\n", esp_err_to_name(err));
            usb_host_transfer_free(xfer);
            return false;
        }

        if (xSemaphoreTake(sXferSem, pdMS_TO_TICKS(timeoutMs)) != pdTRUE) {
            Serial.println("[USB] Transfer timeout");
            usb_host_transfer_free(xfer);
            return false;
        }

        bool ok = (xfer->status == USB_TRANSFER_STATUS_COMPLETED);
        usb_host_transfer_free(xfer);
        if (!ok) return false;

        offset += thisChunk;
    }

    return true;
}

void usbPrinterDisconnect() {
    sReady = false;
    if (sDevHdl) {
        if (sIfaceNum != 0xFF) {
            usb_host_interface_release(sClientHdl, sDevHdl, sIfaceNum);
            sIfaceNum = 0xFF;
        }
        usb_host_device_close(sClientHdl, sDevHdl);
        sDevHdl = NULL;
    }
    sBulkOutEp = 0;
}

uint16_t usbPrinterVid() { return sVid; }
uint16_t usbPrinterPid() { return sPid; }
const char* usbPrinterManufacturer() { return sManufacturer; }
const char* usbPrinterProduct() { return sProduct; }
const char* usbPrinterSerial() { return sSerialStr; }
