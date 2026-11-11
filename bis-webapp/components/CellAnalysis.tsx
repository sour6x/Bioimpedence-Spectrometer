"use client";

import { useMemo, useState } from "react";
import type { BISSample } from "@/lib/bis";
import "./CellAnalysis.css";
import ColePlot, { ColeFitDetails } from "./ColePlot";
import { fitCole } from "@/lib/cole";

type Props = { measurements: BISSample[]; measuring: boolean; simulated: boolean };
export function CellAnalysis({measurements,measuring,simulated}:Props) {
  const [selectedIndex,setSelectedIndex]=useState<number|null>(null);
  const safeSamples=measurements.filter(m=>[m.frequency,m.resistance,m.reactance,m.impedance,m.phase].every(Number.isFinite)&&m.frequency>0);
  const index=selectedIndex!==null&&selectedIndex<safeSamples.length?selectedIndex:safeSamples.length-1;
  const selected=safeSamples[index];
  const scale=selected?150/Math.max(Math.abs(selected.resistance),Math.abs(selected.reactance),1):1;
  const vx=320+(selected?.resistance??0)*scale,vy=190-(selected?.reactance??0)*scale;
  const fit = useMemo(() => fitCole(measurements), [measurements]);
  return <section className="dp-page" aria-label="Electrical response plots">
    {!selected?<><div className="dp-grid">
  <article className="dp-card"><h2>Impedance vector</h2><div className="dp-empty-plot" role="img" aria-label="Impedance vector axes, awaiting ESP32 samples"><span className="dp-axis-y">X (Ω)</span><span className="dp-axis-x">R (Ω)</span><span>Awaiting measurement</span></div></article>
  <article className="dp-card"><h2>Cole–Cole view</h2><div className="dp-empty-plot" role="img" aria-label="Cole–Cole axes, awaiting ESP32 samples"><span className="dp-axis-y">−X (Ω)</span><span className="dp-axis-x">R (Ω)</span><span>Awaiting measurement</span></div></article>
</div></>:<>
      <section className="dp-card dp-frequency-panel" aria-label="Received frequencies"><div className="dp-card-heading"><div><div className="small-label">RECEIVED FREQUENCIES</div><h2>{selected.frequency/1000} kHz <small>{selectedIndex===null?"· following latest sample":"· selected sample"}</small></h2></div><button className="secondary-button" onClick={()=>setSelectedIndex(null)} disabled={selectedIndex===null}>Follow latest</button></div><div className="dp-frequency-list">{safeSamples.map((m,i)=><button key={i} aria-pressed={index===i} onClick={()=>setSelectedIndex(i)}>{m.frequency/1000} kHz<span>#{i+1}</span></button>)}</div></section>
      <div className="dp-grid">
        <article className="dp-card"><div className="small-label">SELECTED FREQUENCY · {selected.frequency/1000} kHz</div><h2>Impedance vector</h2>
          <svg className="cell-vector" viewBox="0 0 640 400" role="img" aria-label={`Impedance vector at ${selected.frequency/1000} kilohertz. Resistance ${selected.resistance.toFixed(2)} ohms, signed reactance ${selected.reactance.toFixed(2)} ohms. Horizontal axis R, vertical axis X.`}>
            <defs><marker id="vector-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(--orange-light)"/></marker></defs>
            <g stroke="var(--border)" strokeWidth="1"><path d="M45 190H595M320 25V365"/><path d="M170 40V340M470 40V340M65 115H575M65 265H575" strokeDasharray="4 8"/></g>
            <g fill="var(--muted)" fontSize="13"><text x="572" y="180">+R</text><text x="48" y="180">−R</text><text x="330" y="35">+X</text><text x="330" y="360">−X</text><text x="300" y="211">0</text></g>
            <path d={`M320 190H${vx}`} fill="none" stroke="#e8b9b0" strokeWidth={3}/><path d={`M${vx} 190V${vy}`} fill="none" stroke="#bfa4b0" strokeWidth={3} strokeDasharray="6 5"/>
            <path d={`M320 190L${vx} ${vy}`} stroke="var(--orange-light)" fill="none" strokeWidth={4} markerEnd="url(#vector-arrow)"/><circle cx={vx} cy={vy} r="6" fill="var(--orange-light)"/>
            <text x="34" y="390" fill="var(--muted)" fontSize="12">R = {selected.resistance.toFixed(2)} Ω · X = {selected.reactance.toFixed(2)} Ω · supplied phase = {selected.phase.toFixed(2)}°</text>
          </svg>
        </article>
<article className="dp-card"><div className="small-label">{simulated?"SIMULATED SWEEP":"RECEIVED SWEEP"}</div><h2>Cole–Cole model</h2><ColePlot samples={safeSamples} fit={fit} highlightFrequency={selected.frequency}/>{!measuring ? <ColeFitDetails fit={fit}/> : <p className="dp-note">Receiving points. Model parameters are provisional until the sweep stops.</p>}</article>
      </div>
    </>}
  </section>;
}








