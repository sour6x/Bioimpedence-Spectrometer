/*
  BISHotspot - ESP32 DevKit / ESP32-WROOM-32
  Creates a Wi-Fi hotspot and serves generated random sweep data to the BIS app.
  No external sensors or GPIO signal outputs are used by this sketch.

  Hotspot: BIS-Wearable
  Password: BISwearable32
  Address: http://192.168.4.1

  App API: GET /status, POST /start, GET /data?after=N
  The after cursor acknowledges the last sample accepted by the app.
*/
#include <WiFi.h>
#include <WebServer.h>
#include <esp_system.h>
#include <math.h>
#include <stdint.h>

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

static const char* AP_NAME = "BIS-Wearable";
static const char* AP_PASSWORD = "BISwearable32";
WebServer server(80);
BIS::SweepEngine sweep;

// Keep this declaration after Frame so Arduino does not generate it before the type.
void sendFrame(const BIS::Frame& frame);

bool allowBrowserOrigin() {
  const String origin = server.header("Origin");
  // Direct browser navigation and terminal requests do not have an Origin.
  // Only the locally hosted app is permitted for cross-origin requests.
  if (origin.length() && origin != "http://localhost:3000" && origin != "http://127.0.0.1:3000") {
    server.send(403, "application/json", "{\"error\":\"Open the app on http://localhost:3000\"}");
    return false;
  }
  if (origin.length()) {
    server.sendHeader("Access-Control-Allow-Origin", origin);
    server.sendHeader("Vary", "Origin");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");
    server.sendHeader("Access-Control-Allow-Private-Network", "true");
  }
  server.sendHeader("Cache-Control", "no-store");
  return true;
}

void sendFrame(const BIS::Frame& frame) {
  char json[384];
  const int length = snprintf(json, sizeof(json),
    "{\"frequency_hz\":%u,\"resistance\":%.6f,\"reactance\":%.6f,"
    "\"impedance\":%.6f,\"phase\":%.6f,\"sample\":%u,"
    "\"measuring\":%s,\"total_samples\":%u,\"simulated\":true}",
    unsigned(frame.frequency), frame.resistance, frame.reactance,
    frame.impedance, frame.phase, frame.sample,
    frame.measuring ? "true" : "false", BIS::TOTAL_SAMPLES);
  if (length < 0 || unsigned(length) >= sizeof(json)) {
    server.send(500, "application/json", "{\"error\":\"Frame could not be encoded\"}");
    return;
  }
  server.send(200, "application/json", json);
}

void handleStatus() {
  if (!allowBrowserOrigin()) return;
  char json[192];
  snprintf(json, sizeof(json),
    "{\"connected\":true,\"measuring\":%s,\"sample\":%u,\"total_samples\":%u}",
    sweep.running() ? "true" : "false", sweep.published(), BIS::TOTAL_SAMPLES);
  server.send(200, "application/json", json);
}

void handleStart() {
  if (!allowBrowserOrigin()) return;
  sweep.start(millis(), esp_random());
  Serial.println("New sweep started");
  server.send(200, "application/json", "{\"started\":true,\"total_samples\":11}");
}

void handleData() {
  if (!allowBrowserOrigin()) return;
  // A direct /data request inspects the latest frame without advancing the sweep.
  if (!server.hasArg("after")) {
    sendFrame(sweep.snapshot());
    return;
  }
  const String cursor = server.arg("after");
  if (cursor.length() == 0 || cursor.length() > 2) {
    server.send(400, "application/json", "{\"error\":\"Invalid sample cursor\"}");
    return;
  }
  for (unsigned i = 0; i < cursor.length(); ++i) {
    if (cursor[i] < '0' || cursor[i] > '9') {
      server.send(400, "application/json", "{\"error\":\"Invalid sample cursor\"}");
      return;
    }
  }
  BIS::Frame frame;
  if (!sweep.readAfter(unsigned(cursor.toInt()), millis(), frame)) {
    server.send(409, "application/json", "{\"error\":\"Cursor ahead of sweep; start a new measurement\"}");
    return;
  }
  sendFrame(frame);
}

void handleOptions() {
  if (!allowBrowserOrigin()) return;
  server.send(204, "text/plain", "");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  WiFi.mode(WIFI_AP);
  const IPAddress address(192, 168, 4, 1);
  const IPAddress subnet(255, 255, 255, 0);
  if (!WiFi.softAPConfig(address, address, subnet) || !WiFi.softAP(AP_NAME, AP_PASSWORD)) {
    Serial.println("Hotspot could not start. Reset the board to retry.");
    while (true) delay(1000);
  }
  const char* headers[] = {"Origin"};
  server.collectHeaders(headers, 1);
  server.on("/", HTTP_GET, []() {
    if (!allowBrowserOrigin()) return;
    server.send(200, "application/json", "{\"device\":\"BIS Wearable\",\"status\":\"/status\",\"start\":\"POST /start\",\"data\":\"GET /data?after=N\"}");
  });
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/start", HTTP_POST, handleStart);
  server.on("/data", HTTP_GET, handleData);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/start", HTTP_OPTIONS, handleOptions);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() {
    if (!allowBrowserOrigin()) return;
    server.send(404, "application/json", "{\"error\":\"Unknown endpoint\"}");
  });
  server.begin();
  Serial.println();
  Serial.println("BIS hotspot ready");
  Serial.print("Wi-Fi: "); Serial.println(AP_NAME);
  Serial.print("Password: "); Serial.println(AP_PASSWORD);
  Serial.print("Address: http://"); Serial.println(WiFi.softAPIP());
  Serial.println("Connect the laptop, run the app locally, then start a measurement.");
}

void loop() {
  server.handleClient();
  delay(2);
}

