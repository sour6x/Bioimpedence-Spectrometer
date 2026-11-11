
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiveBISChart from "@/components/LiveBISChart";
import AmbientParticles from "@/components/AmbientParticles";
import StatusDot from "@/components/StatusDot";

import BodyComposition from "@/components/BodyComposition";
import { CellAnalysis } from "@/components/CellAnalysis";
import Reports from "@/components/Reports";
import { EMPTY_PLACEMENT, type Placement } from "@/lib/reports";
import type { BISSample } from "@/lib/bis";
import { BISBluetoothClient, bluetoothError } from "@/lib/bluetooth";
import { DEFAULT_PREDICTION, calculateComposition, compositionSignature, type CompositionRecord, type PredictionProfile } from "@/lib/composition";

type Section = "measurement" | "cells" | "composition" | "reports";
type Theme = "dark" | "light";

type ESP32Data = {
  frequency_hz: number;
  resistance?: number;
  reactance?: number;
  impedance?: number;
  phase?: number;
  voltage_rms?: number;
  current_rms?: number;
  phase_deg?: number;
  sample: number;
  measuring: boolean;
  simulated?: boolean;
};

type ESP32Status = {
  connected: boolean;
  measuring?: boolean;
  sample?: number;
  total_samples?: number;
};

const ESP32_URL = "http://192.168.4.1";

const FREQUENCIES = [
  4000, 8000, 10000, 16000, 20000, 30000,
  40000, 60000, 80000, 100000, 120000
];

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "measurement", label: "Measurement", icon: "◉" },
  { id: "cells", label: "Cell Analysis", icon: "◎" },
  { id: "composition", label: "Body Composition", icon: "◈" },
  { id: "reports", label: "Reports", icon: "▤" }
];

function processSample(data: ESP32Data): BISSample | null {
  const f = data.frequency_hz;

  if (!Number.isFinite(f) || f <= 0) return null;

  // New firmware: calculate impedance from raw RMS values.
  if (
    typeof data.voltage_rms === "number" &&
    typeof data.current_rms === "number" &&
    typeof data.phase_deg === "number"
  ) {
    if (
      !Number.isFinite(data.voltage_rms) ||
      !Number.isFinite(data.current_rms) ||
      !Number.isFinite(data.phase_deg) ||
      data.current_rms <= 0 ||
      data.voltage_rms < 0
    ) {
      return null;
    }

    const impedance = data.voltage_rms / data.current_rms;
    const radians = data.phase_deg * Math.PI / 180;

    return {
      frequency: f,
      impedance,
      resistance: impedance * Math.cos(radians),
      reactance: impedance * Math.sin(radians),
      phase: data.phase_deg
    };
  }

  // Original firmware: accept precomputed impedance fields.
  if (
    typeof data.resistance === "number" &&
    typeof data.reactance === "number" &&
    typeof data.impedance === "number" &&
    typeof data.phase === "number"
  ) {
    const values = [
      data.resistance, data.reactance,
      data.impedance, data.phase
    ];

    if (!values.every(Number.isFinite)) return null;

    return {
      frequency: f,
      resistance: data.resistance,
      reactance: data.reactance,
      impedance: data.impedance,
      phase: data.phase
    };
  }

  return null;
}

function format(value: number | undefined, digits = 2) {
  return value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

export default function Home() {
  const [section, setSection] = useState<Section>("measurement");
  const [theme, setTheme] = useState<Theme>("dark");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [placement, setPlacement] = useState<Placement>({...EMPTY_PLACEMENT});
  const [reportName, setReportName] = useState("");
  const [predictionProfile, setPredictionProfile] = useState<PredictionProfile>({...DEFAULT_PREDICTION});
  const [compositionRecord, setCompositionRecord] = useState<CompositionRecord|null>(null);
  const [compositionHeight, setCompositionHeight] = useState("");
  const [compositionWeight, setCompositionWeight] = useState("");
  const [compositionMeasurements, setCompositionMeasurements] = useState<BISSample[]>([]);
  const [compositionSimulated, setCompositionSimulated] = useState(true);
  const [compositionErrors, setCompositionErrors] = useState<string[]>([]);
  const [reportSource, setReportSource] = useState<"measurement" | "composition">("measurement");

  const [connected, setConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"bluetooth" | "wifi">("bluetooth");
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("Connect ESP32 via Bluetooth");
  const [measuring, setMeasuring] = useState(false);
  const [measurements, setMeasurements] = useState<BISSample[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null);
  const [simulated, setSimulated] = useState(true);

  const currentComposition = !measuring && compositionRecord?.signature === compositionSignature(compositionMeasurements, compositionHeight, compositionWeight, predictionProfile, compositionSimulated) ? compositionRecord : null;

  const pollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bluetoothRef = useRef<BISBluetoothClient | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("bis-theme");
    const next: Theme = saved === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const frame = requestAnimationFrame(() => setTheme(next));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      if (connectionMode === "bluetooth") {
        const client = bluetoothRef.current;
        if (!client?.connected || pollingRef.current) return;
        try {
          await client.readStatus();
          if (!cancelled) setConnected(client.connected);
        } catch {
          if (!cancelled && !client.connected) setConnected(false);
        }
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(
          `${ESP32_URL}/status?t=${Date.now()}`,
          { cache: "no-store", signal: controller.signal }
        );

        if (!response.ok) throw new Error("Device unavailable");

        const data: ESP32Status = await response.json();
        if (cancelled) return;

        const online = data.connected === true;
        setConnected(online);

        if (!pollingRef.current) {
          setStatus(online ? "ESP32 connected · Ready" : "ESP32 offline");
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          if (!pollingRef.current) setStatus("ESP32 offline");
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    checkConnection();
    const interval = setInterval(checkConnection, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connectionMode]);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      bluetoothRef.current?.disconnect();
    };
  }, [stopPolling]);

  async function connectBluetooth() {
    if (connecting || measuring) return;
    if (bluetoothRef.current?.connected) {
      bluetoothRef.current.disconnect();
      return;
    }
    setConnecting(true);
    setStatus("Choose BIS-Wearable-BLE in the Bluetooth picker");
    const client = new BISBluetoothClient(() => {
      const interrupted = pollingRef.current;
      stopPolling();
      setConnected(false);
      setMeasuring(false);
      setCurrentFrequency(null);
      setStatus(interrupted ? "Measurement interrupted · Bluetooth disconnected" : "ESP32 Bluetooth disconnected");
    });
    bluetoothRef.current = client;
    try {
      await client.connect();
      setConnected(client.connected);
      setStatus("ESP32 Bluetooth connected · Ready");
    } catch (error) {
      setConnected(false);
      setStatus(bluetoothError(error));
    } finally { setConnecting(false); }
  }

  function changeConnectionMode(mode: "bluetooth" | "wifi") {
    if (measuring || connecting || mode === connectionMode) return;
    bluetoothRef.current?.disconnect();
    setConnected(false);
    setConnectionMode(mode);
    setStatus(mode === "bluetooth" ? "Connect ESP32 via Bluetooth" : "Checking ESP32 Wi-Fi...");
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("bis-theme", next);
  }

  function resetMeasurement() {
    stopPolling();
    setMeasurements([]);
    setProgress(0);
    setCurrentFrequency(null);
    setMeasuring(false);
    setStatus(connected ? "ESP32 connected · Ready" : "ESP32 offline");
    setSection("measurement");
  }

  function resetComposition() {
    if (measuring) return;
    setCompositionHeight("");
    setCompositionWeight("");
    setPredictionProfile({ ...DEFAULT_PREDICTION });
    setCompositionMeasurements([]);
    setCompositionRecord(null);
    setCompositionErrors([]);
  }

  async function startMeasurement(mode: "measurement" | "composition" = "measurement") {
    const forComposition = mode === "composition";
    const subjectHeight = forComposition ? compositionHeight : height;
    const subjectWeight = forComposition ? compositionWeight : weight;
    const h = Number(subjectHeight);
    const w = Number(subjectWeight);

    if (forComposition) {
      const reasons: string[] = [];
      if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) reasons.push("Enter valid height and weight.");
      const age = Number(predictionProfile.age);
      if (!Number.isFinite(age) || age < 22 || age > 94) reasons.push("Enter an age from 22 to 94.");
      if (!predictionProfile.sex) reasons.push("Choose an equation sex coefficient.");
      if (predictionProfile.layout !== "whole-body") reasons.push("Choose the hand-to-foot layout for whole-body results.");
      const profileBMI = w / (h / 100) ** 2;
      if (Number.isFinite(profileBMI) && (profileBMI < 17 || profileBMI > 33.8)) reasons.push("The profile BMI must be within 17.0–33.8 for this model.");
      setCompositionErrors(reasons);
      if (reasons.length) return;
    }

    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
      setStatus("Enter valid height and weight");
      return;
    }

    if (!connected || measuring) {
      setStatus("ESP32 must be connected before measuring");
      if (forComposition) setCompositionErrors(["Connect to the ESP32 before measuring."]);
      return;
    }

    stopPolling();
    setReportSource(mode);
    if (forComposition) {
      setCompositionMeasurements([]);
      setCompositionRecord(null);
    } else setMeasurements([]);
    setProgress(0);
    setCurrentFrequency(null);
    setMeasuring(true);
    setStatus("Starting frequency sweep...");

    try {
      const bluetooth = connectionMode === "bluetooth" ? bluetoothRef.current : null;
      if (connectionMode === "bluetooth") {
        if (!bluetooth?.connected) throw new Error("Connect ESP32 via Bluetooth first.");
        await bluetooth.start();
      } else {
        const response = await fetch(`${ESP32_URL}/start`, { method: "POST", cache: "no-store" });
        if (!response.ok) throw new Error("Start request failed");
      }

      pollingRef.current = true;
      let lastSample = 0;
      let failures = 0;
      const receivedSamples: BISSample[] = [];
      let sweepSimulated = forComposition ? compositionSimulated : simulated;

      const poll = async () => {
        if (!pollingRef.current) return;

        try {
          let data: ESP32Data;
          if (bluetooth) {
            data = await bluetooth.readAfter(lastSample);
          } else {
            const result = await fetch(`${ESP32_URL}/data?after=${lastSample}&t=${Date.now()}`, { cache: "no-store" });
            if (!result.ok) throw new Error("Data request failed");
            data = await result.json();
          }
          if (!pollingRef.current) return;
          failures = 0;
          setConnected(true);

          if (typeof data.simulated === "boolean") {
            sweepSimulated = data.simulated;
            if (forComposition) setCompositionSimulated(data.simulated);
            else setSimulated(data.simulated);
          }

          if (
            Number.isInteger(data.sample) &&
            data.sample > lastSample &&
            data.frequency_hz > 0
          ) {
            const sample = processSample(data);

            if (!sample) {
              throw new Error("Invalid impedance sample");
            }

            lastSample = data.sample;
            receivedSamples.push(sample);
            if (forComposition) setCompositionMeasurements(previous => [...previous, sample]);
            else setMeasurements(previous => [...previous, sample]);
            setCurrentFrequency(sample.frequency);
            setProgress(
              Math.min(100, data.sample / FREQUENCIES.length * 100)
            );
            setStatus(`Measuring at ${sample.frequency / 1000} kHz`);
          }

          if (!data.measuring && data.sample >= FREQUENCIES.length) {
            stopPolling();
            setMeasuring(false);
            setProgress(100);
            setCurrentFrequency(null);
            setStatus("Measurement complete");
            if (forComposition) {
              const result = calculateComposition(receivedSamples, subjectHeight, subjectWeight, predictionProfile, sweepSimulated);
              if (result.ok) {
                setCompositionRecord(result.record);
                setCompositionErrors([]);
              } else setCompositionErrors(result.reasons);
            }
            return;
          }

          if (!data.measuring && data.sample < FREQUENCIES.length) {
            throw new Error("Sweep stopped before completion");
          }

          if (pollingRef.current) {
            timerRef.current = setTimeout(poll, 300);
          }
        } catch (error) {
          console.error(error);
          failures++;

          if (failures < 3 && pollingRef.current) {
            timerRef.current = setTimeout(poll, 500);
          } else {
            stopPolling();
            setMeasuring(false);
            setCurrentFrequency(null);
            setStatus("Measurement interrupted · Check ESP32");
            if (forComposition) setCompositionErrors(["Sweep interrupted. Check the ESP32 and measure again."]);
          }
        }
      };

      timerRef.current = setTimeout(poll, 500);
    } catch (error) {
      console.error(error);
      stopPolling();
      setMeasuring(false);
      setStatus("Could not start ESP32 measurement");
      if (forComposition) setCompositionErrors(["Could not start the sweep. Check the ESP32 connection."]);
    }
  }

  function exportCSV() {
    if (!measurements.length) return;

    const rows = [
      "Frequency (Hz),Resistance (Ohm),Reactance (Ohm),Impedance (Ohm),Phase (deg),Simulated",
      ...measurements.map(m =>
        [
          m.frequency,
          m.resistance,
          m.reactance,
          m.impedance,
          m.phase,
          simulated
        ].join(",")
      )
    ];

    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bis-sweep-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const latest = measurements.at(-1);
  const first = measurements[0];

  const bmi =
    Number(height) > 0 && Number(weight) > 0
      ? Number(weight) / Math.pow(Number(height) / 100, 2)
      : null;

  const completed = !measuring && measurements.length === FREQUENCIES.length;

  return (
    <main className={`bis-app ${section === "measurement" ? "measurement-view" : "analysis-view"}`}>
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-glow ambient-glow-blue" />
        <div className="ambient-glow ambient-glow-purple" />
        <div className="ambient-glow ambient-glow-cyan" />
        <AmbientParticles />
        <span className="floating-light light-1" />
        <span className="floating-light light-2" />
        <span className="floating-light light-3" />
      </div>

      <div className="bis-container">
        <header className="bis-header">
          <div className="brand">
            <div className="brand-icon">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M6 34H15L22 19L33 45L42 27L48 34H58"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="brand-name">BIS Wearable</div>
              <div className="brand-subtitle">BIOIMPEDANCE SPECTROSCOPY</div>
            </div>
          </div>

          <div className="header-actions">

            <div className="connection-controls">
              <select aria-label="Connection method" value={connectionMode} disabled={measuring || connecting}
                onChange={event => changeConnectionMode(event.target.value as "bluetooth" | "wifi")}>
                <option value="bluetooth">Bluetooth</option><option value="wifi">Wi-Fi</option>
              </select>
              {connectionMode === "bluetooth" && <button type="button" className="connect-button"
                disabled={connecting || measuring} onClick={connectBluetooth}>
                {connecting ? "Connecting…" : connected ? "Disconnect" : "Connect Bluetooth"}
              </button>}
            </div>
            <div className={`device-pill ${connected ? "device-connected" : "device-disconnected"}`}>
              <StatusDot connected={connected} measuring={measuring}/>
              {connected ? `ESP32 ${connectionMode === "bluetooth" ? "BLE" : "Wi-Fi"}` : "ESP32 Offline"}
            </div>
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <span className="theme-sun">☀</span>
              <span className="theme-knob">{theme === "dark" ? "☾" : "☀"}</span>
              <span className="theme-moon">☾</span>
            </button>
          </div>
        </header>

        <nav className="bis-main-nav" aria-label="Dashboard navigation">
          <div className="nav-caption">WORKSPACE <span>04</span></div>
          {NAV.map(item => (
            <button
              type="button"
              key={item.id}
              className={`bis-nav-item ${section === item.id ? "bis-nav-active" : ""}`}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="bis-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="nav-footnote"><span className="rail-mark">⌁</span> BIS Wearable<span>Experimental research</span></div>
        </nav>

        <div className="page-content">
        {section === "measurement" && (
          <div className={`measurement-workspace ${measuring || measurements.length ? "has-measurements" : ""}`}>
            <div className="workspace-heading">
              <h1><span>01 /</span> Measurement</h1>
              <span className="sweep-range">4—120 <span>kHz</span></span>
            </div>

            {!measuring && measurements.length === 0 && (
              <>
                <section className="input-grid">
                  <div className="input-card">
                    <div className="input-icon">↕</div>
                    <div className="input-content">
                      <label htmlFor="height">Subject height</label>
                      <div className="input-row">
                        <input
                          id="height"
                          type="number"
                          min="1"
                          value={height}
                          placeholder="175"
                          onChange={e => setHeight(e.target.value)}
                        />
                        <span>cm</span>
                      </div>
                    </div>
                  </div>

                  <div className="input-card">
                    <div className="input-icon">⚖</div>
                    <div className="input-content">
                      <label htmlFor="weight">Subject weight</label>
                      <div className="input-row">
                        <input
                          id="weight"
                          type="number"
                          min="1"
                          value={weight}
                          placeholder="75"
                          onChange={e => setWeight(e.target.value)}
                        />
                        <span>kg</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="start-section">
                  <button
                    type="button"
                    className="start-button"
                    onClick={() => startMeasurement()}
                  >
                    <div className="start-left">
                      <div className="play-icon">▶</div>
                      <div>
                        <div className="start-title">Start Measurement</div>
                      </div>
                    </div>
                    <div className="arrow-button">→</div>
                  </button>
                </section>
              </>
            )}

            {(measuring || measurements.length > 0) && (
              <section className="measurement-panel">
                <div className="measurement-header">
                  <div>
                    <div className="small-label">FREQUENCY SWEEP</div>
                    <h2>
                      {measuring
                        ? "Scanning impedance"
                        : completed
                          ? "Measurement complete"
                          : "Partial measurement"}
                    </h2>
                  </div>
                  <div className="progress-number">{Math.round(progress)}%</div>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="frequency-status">
                  <div>
                    <span className="frequency-label">Frequency</span>
                    <strong>
                      {currentFrequency
                        ? `${currentFrequency / 1000} kHz`
                        : latest
                          ? `${latest.frequency / 1000} kHz`
                          : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="frequency-label">Samples received</span>
                    <strong>{measurements.length} / {FREQUENCIES.length}</strong>
                  </div>
                </div>

                <div className="frequency-list">
                  {FREQUENCIES.map((f, i) => (
                    <span
                      key={f}
                      className={`frequency-chip ${
                        i < measurements.length ? "frequency-complete" : ""
                      } ${
                        f === currentFrequency ? "frequency-active" : ""
                      }`}
                    >
                      {f / 1000} kHz
                    </span>
                  ))}
                </div>
              </section>
            )}

            {measurements.length > 0 && (
              <section className="result-section">
                <div className="section-heading">
                  <div className="hero-label">LIVE ANALYSIS</div>
                  <h2>Impedance response</h2>
                  <p>Frequency-dependent electrical impedance spectrum.</p>
                </div>
                <div className="chart-card">
                  <LiveBISChart data={measurements} />
                </div>
              </section>
            )}

            {latest && (
              <>
                <section className="result-grid">
                  {[
                    { label: "IMPEDANCE |Z|", value: format(latest.impedance), unit: "Ω" },
                    { label: "RESISTANCE R", value: format(latest.resistance), unit: "Ω" },
                    { label: "REACTANCE X", value: format(latest.reactance), unit: "Ω" },
                    { label: "PHASE ANGLE", value: format(latest.phase), unit: "°" },
                    { label: "LATEST FREQUENCY", value: format(latest.frequency / 1000, 0), unit: "kHz" },
                    { label: "SUBJECT BMI", value: format(bmi ?? undefined, 1), unit: "" }
                  ].map(metric => (
                    <div className="result-card" key={metric.label}>
                      <div className="result-label">{metric.label}</div>
                      <div className="result-value">
                        {metric.value}<span>{metric.unit}</span>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="result-section">
                  <div className="section-heading">
                    <div className="hero-label">INTERPRETATION</div>
                    <h2>Understanding the measurement</h2>
                    <p>
                      The values describe electrical behavior, not a
                      medical diagnosis or a body-fat measurement.
                    </p>
                  </div>

                  <div className="insight-grid">
                    <div className="result-card">
                      <div className="result-label">RESISTANCE</div>
                      <p>
                        Resistance describes the in-phase opposition
                        to alternating current.
                      </p>
                    </div>
                    <div className="result-card">
                      <div className="result-label">REACTANCE</div>
                      <p>
                        Reactance describes the reactive response,
                        including capacitive effects associated with
                        cell membranes.
                      </p>
                    </div>
                    <div className="result-card">
                      <div className="result-label">FREQUENCY RESPONSE</div>
                      <p>
                        {first && latest.impedance < first.impedance
                          ? "Impedance decreases across the available frequency range."
                          : first && latest.impedance > first.impedance
                            ? "Impedance increases across the available frequency range."
                            : "Review the complete frequency spectrum for trends."}
                      </p>
                    </div>
                  </div>
                </section>

                {!measuring && (
                  <section className="result-section">
                    <div className="dashboard-actions">
                      <button className="secondary-button" onClick={exportCSV}>
                        ↓ Export CSV
                      </button>
                      <button className="secondary-button" onClick={resetMeasurement}>
                        ↻ New Measurement
                      </button>
                    </div>
                  </section>
                )}

                <section className="result-section">
                  <div className="section-heading">
                    <div className="hero-label">RAW SWEEP DATA</div>
                    <h2>Measurement table</h2>
                  </div>
                  <div className="data-table-wrap">
                    <table className="bis-data-table">
                      <thead>
                        <tr>
                          <th>Frequency</th>
                          <th>Resistance</th>
                          <th>Reactance</th>
                          <th>Impedance</th>
                          <th>Phase</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measurements.map(m => (
                          <tr key={m.frequency}>
                            <td>{m.frequency / 1000} kHz</td>
                            <td>{format(m.resistance, 3)} Ω</td>
                            <td>{format(m.reactance, 3)} Ω</td>
                            <td>{format(m.impedance, 3)} Ω</td>
                            <td>{format(m.phase, 3)}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            <section className="status-card" aria-live="polite" aria-atomic="true">
              <div className="status-icon" aria-hidden="true">⌁</div>
              <div className="status-content">
                <div className="small-label">DEVICE STATUS</div>
                <div className="status-text">{status}</div>
              </div>
              <div className="status-ready">
                <StatusDot connected={connected} measuring={measuring}/>
                {measuring ? "Measuring" : connected ? "Ready" : "Offline"}
              </div>
            </section>
            <div className="workspace-bottom"><span>ESP32 / BIS</span><span>11 frequency points</span></div>
          </div>
        )}

        {section === "cells" && <CellAnalysis measurements={measurements} measuring={measuring} simulated={simulated} />}

        {section === "composition" && (
          <BodyComposition
            measurements={compositionMeasurements}
            measuring={measuring}
            progress={progress}
            simulated={compositionSimulated}
            height={compositionHeight} weight={compositionWeight}
            onHeight={value => { setCompositionHeight(value); setCompositionErrors([]); }}
            onWeight={value => { setCompositionWeight(value); setCompositionErrors([]); }}
            profile={predictionProfile} onProfile={value => { setPredictionProfile(value); setCompositionErrors([]); }}
            record={currentComposition} onRecord={setCompositionRecord}
            connected={connected} onStart={() => startMeasurement("composition")}
            onReset={resetComposition} errors={compositionErrors}
          />
        )}

        {section === "reports" && <Reports measurements={reportSource === "composition" ? compositionMeasurements : measurements} measuring={measuring} simulated={reportSource === "composition" ? compositionSimulated : simulated} height={reportSource === "composition" ? compositionHeight : height} weight={reportSource === "composition" ? compositionWeight : weight} expectedFrequencies={FREQUENCIES} placement={placement} onPlacementChange={setPlacement} name={reportName} onNameChange={setReportName} composition={reportSource === "composition" ? currentComposition : null} />}

        {section !== "measurement" && section !== "cells" && <section className="status-card">
          <div className="status-icon">⌁</div>
          <div className="status-content">
            <div className="small-label">DEVICE STATUS</div>
            <div className="status-text">{status}</div>
          </div>
          <div className="status-ready">
            <StatusDot connected={connected} measuring={measuring}/>
            {measuring ? "Measuring" : connected ? "Ready" : "Offline"}
          </div>
        </section>}

        {section !== "cells" && <footer className="footer">
          <span>BIS Wearable</span>
          <span className="footer-divider">|</span>
          <span>Experimental research system</span>
          <span className="footer-spacer" />
          <span>v0.2.0</span>
          <span className="footer-dot">●</span>
          <span>Built for research</span>
        </footer>}
        </div>
      </div>
    </main>
  );
}








