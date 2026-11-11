"use client";

import type { BISSample } from "@/lib/bis";
import type { CompositionRecord, PredictionProfile } from "@/lib/composition";
import CompositionCalculator from "./CompositionCalculator";
import "./BodyComposition.css";
import { muscleEstimate, adultBMI } from "@/lib/interpretation";
import { CompositionMeaning } from "./ResultMeaning";

type Props = { measurements: BISSample[]; measuring: boolean; progress: number; simulated: boolean; height: string; weight: string; onHeight: (v: string) => void; onWeight: (v: string) => void; profile: PredictionProfile; onProfile: (v: PredictionProfile) => void; record: CompositionRecord | null; onRecord: (v: CompositionRecord) => void; connected: boolean; onStart: () => void; onReset: () => void; errors: string[] };
type Icon = "fat" | "water" | "mass" | "lean" | "volume" | "ratio";

function ResultIcon({ kind }: { kind: Icon }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "fat" && <><circle cx="32" cy="32" r="21" /><circle cx="32" cy="32" r="12" /><circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" /></>}
    {kind === "water" && <><path d="M32 9C27 18 15 30 15 40a17 17 0 0034 0C49 30 37 18 32 9Z" /><path d="M23 40a9 9 0 009 9" /></>}
    {kind === "mass" && <><path d="M19 24h26l8 29H11l8-29Z" /><path d="M25 24v-7a7 7 0 0114 0v7" /><path d="M25 39h14" /></>}
    {kind === "lean" && <><rect x="13" y="11" width="38" height="42" rx="12" /><path d="M24 21v22M32 18v28M40 21v22" /></>}
    {kind === "volume" && <><path d="M19 10v44h26V10M15 10h34M19 34h26" /><path d="M37 18h8M37 26h8M37 42h8" /><path d="M20 35q7-5 13 0t11 0" /></>}
    {kind === "ratio" && <><circle cx="32" cy="32" r="22" /><path d="M32 10v22l16 15" /><path d="M32 32H10" /></>}
  </svg>;
}

export default function BodyComposition({ measurements, measuring, progress, simulated, height, weight, onHeight, onWeight, profile, onProfile, record, onRecord, connected, onStart, onReset, errors }: Props) {
  const output = record?.output;
  const muscle = record ? muscleEstimate(record) : null;
  const bmi = record ? adultBMI(record.profile.height,record.profile.weight,record.profile.age) : null;
  const metrics: { label: string; value: number | undefined; unit: string; icon: Icon; detail: string }[] = [
    { label: "Body fat", value: output?.fatPercent, unit: "%", icon: "fat", detail: "Estimated fat percentage" },
    { label: "Body water", value: output?.waterPercent, unit: "%", icon: "water", detail: "Estimated water percentage" },
    { label: "Fat mass", value: output?.fatMass, unit: "kg", icon: "mass", detail: "Estimated fat weight" },
    { label: "Fat-free mass", value: output?.fatFreeMass, unit: "kg", icon: "lean", detail: "Includes water, organs and bone" },
    { label: "Total body water", value: output?.waterLitres, unit: "L", icon: "volume", detail: "Estimated water volume" },
    { label: "Skeletal muscle", value: muscle?.ok ? muscle.mass : undefined, unit: "kg", icon: "lean", detail: "Janssen 2000 estimate" },
    { label: "Profile BMI", value: bmi?.value, unit: "kg/m²", icon: "ratio", detail: bmi?.category ?? "Weight relative to height" },
    { label: "Fat-free proportion", value: record ? record.output.fatFreeMass / record.profile.weight * 100 : undefined, unit: "%", icon: "ratio", detail: "Fat-free mass / body weight" },
  ];

  return <section className="bc-page" aria-label="Body composition results">
    <section className="bc-calculation" aria-label="Profile and calculation">
      <h1 className="bc-input-heading">Profile & calculation</h1>
      <CompositionCalculator samples={measurements} height={height} weight={weight} onHeight={onHeight} onWeight={onWeight} profile={profile} onProfile={onProfile} record={record} onRecord={onRecord} randomInputs={simulated} measuring={measuring} connected={connected} onStart={onStart} showResults={false} autoCalculate />
      {errors.length > 0 && <div className="bc-errors" role="alert"><ul>{errors.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
    </section>
    <div className="bc-reset-row"><button type="button" className="secondary-button" onClick={onReset} disabled={measuring}>↻ Reset inputs & results</button></div>
    <div className="bc-results-heading">
      <h2>Composition results</h2>
      <span role="status">{measuring ? `Receiving sweep · ${Math.round(progress)}%` : record ? "Example model outputs" : "Awaiting calculation"}</span>
    </div>
    {measuring && <progress className="bc-progress" value={progress} max={100} aria-label="Sweep progress" />}
    <div className="bc-results-grid" aria-live="polite" aria-atomic="true">
      {metrics.map(metric => <article className="bc-result-card" key={metric.label}>
        <div className="bc-result-top"><span>{metric.label}</span><div className="bc-result-icon"><ResultIcon kind={metric.icon} /></div></div>
        <div className="bc-result-value">{metric.value === undefined ? "—" : metric.value.toFixed(1)}<span>{metric.unit}</span></div>
        <p>{metric.value === undefined ? "Calculate to view" : metric.detail}</p>
      </article>)}
    </div>
    {record && <CompositionMeaning record={record}/>}
    <p className="bc-result-note">{record ? "Calculated from random ESP32 inputs. Water is included in fat-free mass; fat-free mass is not muscle mass." : "Enter your profile above, then select Measure & calculate."}</p>

  </section>;
}


