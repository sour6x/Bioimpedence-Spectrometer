/*
  BISBluetooth - ESP32-S3 / ESP32-S3-WROOM dev board
  Arduino IDE: esp32 by Espressif Systems 2.0.17 or 3.3.12; ESP32S3 Dev Module.
  Bluetooth Low Energy name: BIS-Wearable-BLE.
  This preserves BISHotspot's generated 11-frequency test sweep verbatim.
  No external sensors or GPIO outputs are added. Upload this sketch instead
  of BISHotspot to use the app's Bluetooth mode.
*/
#include <Arduino.h>
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR >= 4
#error "Use esp32 board package 2.0.17 or 3.3.12 in Boards Manager (BLE API changed in v4)."
#endif
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <esp_system.h>
#include <math.h>
#include <stdint.h>
#include <string.h>

// BEGIN PORTABLE SWEEP ENGINE
namespace BIS {
static const uint32_t FREQUENCIES[] = {
  4000, 8000, 10000, 16000, 20000, 30000,
  40000, 60000, 80000, 100000, 120000
};
static const unsigned TOTAL_SAMPLES = sizeof(FREQUENCIES) / sizeof(FREQUENCIES[0]);
static const uint32_t SAMPLE_INTERVAL_MS = 700;

struct Frame {
  uint32_t frequency;
  double resistance;
  double reactance;
  double impedance;
  double phase;
  unsigned sample;
  bool measuring;
};

class SweepEngine {
 public:
  void start(uint32_t now, uint32_t seed) {
    published_ = 0;
    started_ = true;
    lastPublishedAt_ = now;
    randomState_ = seed ? seed : 1;
    resistanceHigh_ = 380.0 + nextRandom() % 121;
    resistanceDelta_ = 180.0 + nextRandom() % 101;
    cornerHz_ = 20000.0 + nextRandom() % 25001;
  }

  bool running() const { return started_ && published_ < TOTAL_SAMPLES; }
  unsigned published() const { return published_; }
  Frame snapshot() const { return frameFor(published_); }

  bool readAfter(unsigned accepted, uint32_t now, Frame& result) {
    if (accepted > published_) return false;
    if (accepted < published_) {
      result = frameFor(accepted + 1);
      return true;
    }
    // Advance only after the client acknowledges the previous sample.
    // Retrying an old cursor returns the exact cached frame, never a new value.
    if (running() && uint32_t(now - lastPublishedAt_) >= SAMPLE_INTERVAL_MS) {
      history_[published_] = makeFrame(published_);
      ++published_;
      lastPublishedAt_ = now;
    }
    result = frameFor(published_);
    return true;
  }

 private:
  Frame history_[TOTAL_SAMPLES] = {};
  unsigned published_ = 0;
  bool started_ = false;
  uint32_t lastPublishedAt_ = 0;
  uint32_t randomState_ = 1;
  double resistanceHigh_ = 420;
  double resistanceDelta_ = 230;
  double cornerHz_ = 30000;

  uint32_t nextRandom() {
    randomState_ ^= randomState_ << 13;
    randomState_ ^= randomState_ >> 17;
    randomState_ ^= randomState_ << 5;
    return randomState_;
  }

  double noise() { return double(nextRandom() % 2001) / 1000.0 - 1.0; }

  Frame makeFrame(unsigned index) {
    Frame f = {};
    f.frequency = FREQUENCIES[index];
    const double ratio = double(f.frequency) / cornerHz_;
    // A generated RC-shaped response with small random variation.
    // This is only test data, not a biological measurement or prediction model.
    f.resistance = resistanceHigh_ + resistanceDelta_ / (1.0 + ratio * ratio) + 1.5 * noise();
    f.reactance = -resistanceDelta_ * ratio / (1.0 + ratio * ratio) + 0.5 * noise();
    f.impedance = sqrt(f.resistance * f.resistance + f.reactance * f.reactance);
    f.phase = atan2(f.reactance, f.resistance) * 180.0 / 3.14159265358979323846;
    f.sample = index + 1;
    f.measuring = f.sample < TOTAL_SAMPLES;
    return f;
  }

  Frame frameFor(unsigned count) const {
    if (count == 0) {
      Frame waiting = {};
      waiting.measuring = running();
      return waiting;
    }
    return history_[count - 1];
  }
};
}  // namespace BIS
// END PORTABLE SWEEP ENGINE
static const char* SERVICE_UUID = "b1540001-6f8a-4f98-a773-1d59ad754b10";
static const char* COMMAND_UUID = "b1540002-6f8a-4f98-a773-1d59ad754b10";
static const char* DATA_UUID = "b1540003-6f8a-4f98-a773-1d59ad754b10";
static const char* STATUS_UUID = "b1540004-6f8a-4f98-a773-1d59ad754b10";
BIS::SweepEngine sweep;
BLECharacteristic* dataCharacteristic = nullptr;
volatile bool restartAdvertising = false;

void put32(uint8_t* bytes, uint32_t value);
void putFloat(uint8_t* bytes, double value);
void encodeFrame(BLECharacteristic* characteristic, const BIS::Frame& frame, bool error);

void put32(uint8_t* bytes, uint32_t value) {
  for (unsigned i = 0; i < 4; ++i) bytes[i] = uint8_t(value >> (8 * i));
}

void putFloat(uint8_t* bytes, double value) {
  static_assert(sizeof(float) == 4, "BLE v1 requires 32-bit floats");
  float number = float(value);
  uint32_t bits;
  memcpy(&bits, &number, sizeof(bits));
  put32(bytes, bits);
}

void encodeFrame(BLECharacteristic* characteristic, const BIS::Frame& frame, bool error) {
  uint8_t bytes[20] = {};
  bytes[0] = 1; // Protocol version
  bytes[1] = (frame.measuring ? 1 : 0) | 2 | (error ? 4 : 0); // running, simulated, error
  bytes[2] = uint8_t(frame.sample);
  bytes[3] = uint8_t(BIS::TOTAL_SAMPLES);
  put32(bytes + 4, frame.frequency);
  putFloat(bytes + 8, frame.resistance);
  putFloat(bytes + 12, frame.reactance);
  putFloat(bytes + 16, frame.phase);
  characteristic->setValue(bytes, sizeof(bytes));
}

class StatusCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    encodeFrame(characteristic, sweep.snapshot(), false);
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    const auto received = characteristic->getValue();
    const String command(received.c_str());
    if (command == "START") {
      sweep.start(millis(), esp_random());
      encodeFrame(dataCharacteristic, sweep.snapshot(), false);
      Serial.println("Bluetooth sweep started");
      return;
    }
    if (command.startsWith("NEXT:")) {
      const String cursor = command.substring(5);
      bool valid = cursor.length() > 0 && cursor.length() <= 2;
      for (unsigned i = 0; i < cursor.length(); ++i) {
        if (cursor[i] < '0' || cursor[i] > '9') valid = false;
      }
      BIS::Frame frame;
      if (valid && cursor.toInt() <= int(BIS::TOTAL_SAMPLES) &&
          sweep.readAfter(unsigned(cursor.toInt()), millis(), frame)) {
        encodeFrame(dataCharacteristic, frame, false);
        return;
      }
    }
    encodeFrame(dataCharacteristic, sweep.snapshot(), true);
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    restartAdvertising = false;
    Serial.println("Browser connected via BLE");
  }
  void onDisconnect(BLEServer*) override {
    restartAdvertising = true;
    Serial.println("Browser disconnected; ready to reconnect");
  }
};

void setup() {
  Serial.begin(115200);
  delay(200);
  BLEDevice::init("BIS-Wearable-BLE");
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(SERVICE_UUID);
  BLECharacteristic* command = service->createCharacteristic(COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  dataCharacteristic = service->createCharacteristic(DATA_UUID, BLECharacteristic::PROPERTY_READ);
  BLECharacteristic* status = service->createCharacteristic(STATUS_UUID, BLECharacteristic::PROPERTY_READ);
  command->setCallbacks(new CommandCallbacks());
  status->setCallbacks(new StatusCallbacks());
  encodeFrame(dataCharacteristic, sweep.snapshot(), false);
  encodeFrame(status, sweep.snapshot(), false);
  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("BIS-Wearable-BLE ready. Open the app and click Connect Bluetooth.");
}

void loop() {
  if (restartAdvertising) {
    restartAdvertising = false;
    delay(500);
    BLEDevice::startAdvertising();
  }
  delay(10);
}
