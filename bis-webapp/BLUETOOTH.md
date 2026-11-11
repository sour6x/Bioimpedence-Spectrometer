# Bluetooth connection for ESP32-S3

Use `firmware/BISBluetooth/BISBluetooth.ino` instead of the earlier `BISHotspot` sketch. It retains the original generated random test sweep (11 points from 4–120 kHz), its acknowledgement/retry behavior, and the simulated-data marker. It does not add sensor acquisition.

## Upload in Arduino IDE

1. In Boards Manager, use **esp32 by Espressif Systems 2.0.17** (already installed on this computer) or **3.3.12**. The sketch uses the built-in BLE library; do not install the obsolete standalone ESP32 BLE Arduino library. Version 4 has a different BLE API and is intentionally rejected with a clear compile message.
2. Select **ESP32S3 Dev Module** if your board is ESP32-S3-WROOM. Select the board's actual USB port and retain its existing flash/PSRAM settings.
3. Open `BISBluetooth.ino` and upload it. Serial Monitor at **115200** should print `BIS-Wearable-BLE ready`.
4. Turn on Bluetooth on the computer. Keep the board powered nearby.

## Connect the app

1. Run `npm run dev` in the project folder and open **http://localhost:3000** in Chrome or Edge. A local loopback URL or HTTPS is required.
2. Keep **Bluetooth** selected in the header. Click **Connect Bluetooth** and select **BIS-Wearable-BLE** in the browser's device picker.
3. Wait for **ESP32 BLE** / **Ready**, then use Measurement or Body Composition as before. No Wi-Fi hotspot is needed in Bluetooth mode.
4. If the built-in preview reports Bluetooth unavailable or blocked, use the same local app in Chrome or Edge. Bluetooth availability depends on the browser exposing Web Bluetooth; the app does not claim a connection until it reads the matching BLE service.
5. A disconnect stops acquisition and preserves partial samples. Reconnect, then start a fresh sweep. Resetting the ESP32 during a sweep also requires a fresh start.

Body Composition still has separate profile inputs and its own sweep; Measure & calculate computes on successful completion. Reports follows the latest acquisition source.

## Protocol v1

Service `b1540001-6f8a-4f98-a773-1d59ad754b10`; command characteristic ends in `0002`, sample in `0003`, status in `0004` (the remaining UUID suffix is identical).

Write `START` with response, then read sample. Write `NEXT:N` with response, then read sample, where N is the last accepted sample index (0–11). Status reads inspect the engine without advancing it. GATT operations are serialized in the app and bounded by a timeout. Repeated cursors replay the same frame. Frames are 20 bytes, fitting a default ATT MTU without notification chunking.

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | uint8 | Version = 1 |
| 1 | uint8 | Flags: bit 0 measuring, bit 1 simulated, bit 2 protocol error |
| 2 | uint8 | Sample index |
| 3 | uint8 | Total samples = 11 |
| 4 | uint32 little-endian | Frequency in Hz |
| 8 | float32 little-endian | Resistance in ohms |
| 12 | float32 little-endian | Signed reactance in ohms |
| 16 | float32 little-endian | Phase in degrees |

Impedance is reconstructed as hypot(R, X), matching the earlier sketch's formula. Single-precision transmission introduces only float32 rounding. Raw RMS handling in the existing app remains available through Wi-Fi firmware.

The earlier Wi-Fi sketch is retained unchanged as a fallback. Its allowed app origin is localhost/127.0.0.1 on port 3000; do not use a different port with that older sketch.

References: [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth), [Espressif BLE example](https://github.com/espressif/arduino-esp32/blob/3.3.12/libraries/BLE/examples/Server/Server.ino).

## Brave: Connect Bluetooth opens no picker
Brave disables Web Bluetooth by default. Paste brave://flags/#brave-web-bluetooth-api into its address bar, enable Web Bluetooth API, then relaunch Brave. Reopen the local app and click Connect Bluetooth. Alternatively use Chrome or Edge. Do not disable Shields or other unrelated protections. Reference: https://github.com/brave/brave-browser/issues/31605

