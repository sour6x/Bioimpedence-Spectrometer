import type { BISSample } from "./bis";
import { reportAnalysisHTML, REPORT_STYLE } from "./report-analysis";
import { compositionLines, validCompositionRecord, MODEL_SOURCES, type CompositionRecord } from "./composition";
export type Placement = { region:string; electrodes:string; posture:string; currentPositive:string; currentNegative:string; voltagePositive:string; voltageNegative:string; notes:string };
export const EMPTY_PLACEMENT:Placement={region:"",electrodes:"",posture:"",currentPositive:"",currentNegative:"",voltagePositive:"",voltageNegative:"",notes:""};
export type SweepReport = {id:string;name:string;savedAt:string;height:string;weight:string;simulated:boolean;expectedFrequencies:number[];placement:Placement;composition?:CompositionRecord;samples:BISSample[]};
export function validSample(m:unknown):m is BISSample {if(!m||typeof m!=="object")return false;const s=m as BISSample;return [s.frequency,s.resistance,s.reactance,s.impedance,s.phase].every(Number.isFinite)&&s.frequency>0;}
export function validReport(value:unknown):value is SweepReport {
  if(!value||typeof value!=="object")return false;const r=value as SweepReport;
  return typeof r.id==="string"&&typeof r.name==="string"&&typeof r.savedAt==="string"&&Number.isFinite(Date.parse(r.savedAt))&&typeof r.height==="string"&&typeof r.weight==="string"&&typeof r.simulated==="boolean"&&Array.isArray(r.expectedFrequencies)&&r.expectedFrequencies.length>0&&r.expectedFrequencies.every(f=>Number.isFinite(f)&&f>0)&&!!r.placement&&Object.keys(EMPTY_PLACEMENT).every(k=>typeof r.placement[k as keyof Placement]==="string")&&Array.isArray(r.samples)&&r.samples.length>0&&r.samples.every(validSample)&&(r.composition===undefined||validCompositionRecord(r.composition));
}
export function summarize(samples:BISSample[],expected:number[]) {
  const sorted=samples.filter(validSample).slice().sort((a,b)=>a.frequency-b.frequency);
  const first=sorted[0],last=sorted.at(-1);
  const frequencies=new Set(sorted.map(m=>m.frequency));
  const missing=expected.filter(f=>!frequencies.has(f));
  const complete=expected.length>0&&missing.length===0&&frequencies.size===expected.length&&sorted.length===expected.length;
  const change=first&&last?last.impedance-first.impedance:null;
  const lines:string[]=[];
  if(first&&last){
    lines.push(`${sorted.length} samples cover ${first.frequency/1000}–${last.frequency/1000} kHz. At each frequency the app records resistance R, reactance X, impedance |Z| and phase angle from the ESP32 measurement pipeline.`);
    lines.push(sorted.length>1?`Impedance is ${first.impedance.toFixed(2)} Ω at ${first.frequency/1000} kHz and ${last.impedance.toFixed(2)} Ω at ${last.frequency/1000} kHz: ${change!<0?"a decrease":change!>0?"an increase":"no endpoint change"}${change?` of ${Math.abs(change).toFixed(2)} Ω`:""}. This compares different frequencies, not changes in your body over time.`:"Only one frequency has arrived, so a frequency-response trend cannot yet be described.");
    lines.push(`At the highest received frequency, resistance is ${last.resistance.toFixed(2)} Ω, reactance is ${last.reactance.toFixed(2)} Ω and phase is ${last.phase.toFixed(2)}°. Resistance describes the resistive part of opposition to current; reactance describes the reactive part; phase describes the timing difference between voltage and current.`);
    lines.push("These values describe the electrical path between the electrodes. Fat %, body-water % and muscle mass are model estimates, not direct electrical readings. See the interpretation and methods below for the equations and reference limits.");
  }
  return {sorted,first,last,missing,complete,change,lines};
}
function escapeHTML(value:unknown){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function reportHTML(report:SweepReport) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(report.name)}</title><style>${REPORT_STYLE}</style></head><body>${reportAnalysisHTML(report)}</body></html>`;
}