"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BISSample } from "@/lib/bis";
import { reportHTML, summarize, validReport, type Placement, type SweepReport } from "@/lib/reports";
import "./CellAnalysis.css";
import "./Reports.css";
import ColePlot, { ColeFitDetails } from "./ColePlot";
import { fitCole } from "@/lib/cole";
import { sweepInterpretation, compositionInsights } from "@/lib/interpretation";
import { CompositionMeaning } from "./ResultMeaning";

import { compositionLines, MODEL_SOURCES, type CompositionRecord } from "@/lib/composition";

type Props={measurements:BISSample[];measuring:boolean;simulated:boolean;height:string;weight:string;expectedFrequencies:number[];placement:Placement;onPlacementChange:(value:Placement)=>void;name:string;onNameChange:(value:string)=>void;storageKey?:string;composition?:CompositionRecord|null};
import ReportSummary from "./ReportSummary";
import {reportStory,compositionReportStory} from "@/lib/report-story";
const STORAGE_KEY="bis-reports-v1";
function download(report:SweepReport,kind:"csv"|"json"|"html") {
  const analysis=summarize(report.samples,report.expectedFrequencies);
  const content=kind==="html"?reportHTML(report):kind==="json"?JSON.stringify({...report,generatedAt:new Date().toISOString(),explanation:analysis.lines,coleAnalysis:sweepInterpretation(report),bodyCompositionExplanation:report.composition?compositionInsights(report.composition):null,calculationMethod:report.composition?compositionLines(report.composition):[],modelSources:report.composition?MODEL_SOURCES:[],bodyComposition:report.composition??{fatPercent:null,waterPercent:null,muscleMass:null,reason:"No calculation saved for this session"}},null,2):["Frequency (Hz),Resistance (Ohm),Reactance (Ohm),Impedance (Ohm),Phase (deg),Simulated",...report.samples.map(m=>[m.frequency,m.resistance,m.reactance,m.impedance,m.phase,report.simulated].join(","))].join("\n");
  const type=kind==="html"?"text/html;charset=utf-8":kind==="csv"?"text/csv;charset=utf-8":"application/json";
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=`bis-${report.id}.${kind}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Reports({measurements,measuring,simulated,height,weight,expectedFrequencies,placement,name,onNameChange,storageKey=STORAGE_KEY,composition=null}:Props) {
  const [sessions,setSessions]=useState<SweepReport[]>([]),[ready,setReady]=useState(false),[message,setMessage]=useState("");
  const [selected,setSelected]=useState("current"),[compare,setCompare]=useState("");

  useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const raw=localStorage.getItem(storageKey),parsed:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(parsed)||!parsed.every(validReport))throw Error();setSessions(parsed);setReady(true);}catch{setMessage("Saved reports could not be read. Existing browser storage was left unchanged; downloads remain available.");}});return()=>cancelAnimationFrame(frame);},[storageKey]);
  const current:SweepReport={id:"current",name:name.trim()||"Current sweep",savedAt:"",height,weight,simulated,expectedFrequencies,placement,samples:measurements,...(composition?{composition}:{})};
  const active=selected==="current"?current:sessions.find(s=>s.id===selected)??current;
  const comparison=sessions.find(s=>s.id===compare&&s.id!==active.id);
  const summary=summarize(active.samples,active.expectedFrequencies);
  const running=active.id==="current"&&measuring;
  const fit=useMemo(()=>fitCole(active.samples),[active.samples]);
  const story=reportStory(active,fit);
  const plot=summary.sorted.map(m=>({frequency:m.frequency/1000,impedance:m.impedance,comparison:comparison?.samples.find(n=>n.frequency===m.frequency)?.impedance}));
  function save(){if(!ready||measuring||!measurements.length)return;const report:SweepReport={...current,id:crypto.randomUUID(),savedAt:new Date().toISOString(),placement:{...placement},samples:measurements.map(m=>({...m})),expectedFrequencies:[...expectedFrequencies]};if(!validReport(report)){setMessage("This sweep contains invalid values and could not be saved. Check the incoming readings.");return;}const next=[report,...sessions];try{localStorage.setItem(storageKey,JSON.stringify(next));setSessions(next);setSelected(report.id);setMessage("Report saved in this browser.");}catch{setMessage("Browser storage is unavailable or full. Download the report to keep a copy.");}}
  const bmi=Number(active.height)>0&&Number(active.weight)>0?Number(active.weight)/(Number(active.height)/100)**2:null;
  return <section className="dp-page rp-page" aria-labelledby="reports-title">
    <div className="dp-intro"><div className="hero-label">MEASUREMENT REPORTS</div><h1 id="reports-title">Your measurement report.</h1><p>The result, its meaning and the model behind it.</p></div>
    <div className="rp-layout"><aside className="dp-card rp-library"><details><summary>Choose a session</summary><button className={`rp-session ${selected==="current"?"rp-selected":""}`} aria-pressed={selected==="current"} onClick={()=>setSelected("current")}><strong>Current sweep</strong><span>{measurements.length} samples{measuring?" · receiving":""}</span></button>{sessions.map(s=><button key={s.id} className={`rp-session ${active.id===s.id?"rp-selected":""}`} aria-pressed={active.id===s.id} onClick={()=>setSelected(s.id)}><strong>{s.name}</strong><span>{new Date(s.savedAt).toLocaleString()}</span><span>{s.samples.length} samples</span></button>)}{!sessions.length&&<p className="dp-note">Saved reports will appear here.</p>}<p className="dp-note">Saved sessions stay on this browser. Download a copy before clearing browser data.</p></details></aside>
    <div className="rp-content">
      <div className="dp-card"><div className="dp-card-heading"><div><div className="small-label">{running?"SWEEP IN PROGRESS":summary.sorted.length?summary.complete?"FULL CONFIGURED SWEEP":"PARTIAL FREQUENCY COVERAGE":"AWAITING SAMPLES"}</div><h2>{active.name}</h2></div><div className="rp-downloads"><button className="secondary-button" disabled={!summary.sorted.length} onClick={()=>download(active,"html")}>Download report</button><button className="secondary-button" disabled={!summary.sorted.length} onClick={()=>download(active,"csv")}>CSV</button><button className="secondary-button" disabled={!summary.sorted.length} onClick={()=>download(active,"json")}>JSON</button></div></div>
      {active.savedAt&&<p className="dp-note">Saved {new Date(active.savedAt).toLocaleString()}</p>}
      <div className="rp-stats"><div><span>Received samples</span><strong>{summary.sorted.length} / {active.expectedFrequencies.length}</strong></div><div><span>Frequency range</span><strong>{summary.first&&summary.last?`${summary.first.frequency/1000}–${summary.last.frequency/1000} kHz`:"—"}</strong></div><div><span>Height / weight</span><strong>{active.height||"—"} cm / {active.weight||"—"} kg</strong></div><div><span>BMI from height & weight</span><strong>{bmi!==null&&Number.isFinite(bmi)?bmi.toFixed(1):"—"}</strong></div></div>
      {!summary.complete&&summary.sorted.length>0&&<p className="dp-note">Configured frequencies not yet received: {summary.missing.length?summary.missing.map(f=>`${f/1000} kHz`).join(", "):"none; duplicate or additional frequencies are present"}.</p>}
      {selected==="current"&&<details className="report-detail"><summary>Name and save this sweep</summary><div className="rp-save"><label>Session name<input value={name} onChange={e=>onNameChange(e.target.value)} placeholder="Name this report" maxLength={80}/></label><button className="secondary-button" disabled={!ready||measuring||!summary.sorted.length} onClick={save}>Save report</button></div></details>}
      {message&&<p className="dp-note" role="status">{message}</p>}</div>
      {summary.sorted.length > 0 && <>
<ReportSummary report={active} fit={fit} running={running}/>
      <article className="dp-card rp-section"><div className="dp-card-heading"><div><div className="small-label">FREQUENCY RESPONSE</div><h2>01 · What the frequency response means</h2></div><label className="rp-compare">Compare with<select value={comparison?.id??""} onChange={e=>setCompare(e.target.value)}><option value="">No comparison</option>{sessions.filter(s=>s.id!==active.id).map(s=><option value={s.id} key={s.id}>{s.name} · {new Date(s.savedAt).toLocaleString()}</option>)}</select></label></div>
      <p className="report-lead">{story.frequency}</p><div className="dp-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={plot} margin={{top:20,right:20,bottom:15,left:10}}><CartesianGrid stroke="var(--border)"/><XAxis type="number" dataKey="frequency" unit=" kHz" domain={["dataMin","dataMax"]} tick={{fill:"var(--muted)",fontSize:11}}/><YAxis unit=" Ω" domain={["auto","auto"]} tick={{fill:"var(--muted)",fontSize:11}}/><Tooltip contentStyle={{background:"var(--background)",color:"var(--foreground)",borderColor:"var(--border)"}}/><Legend/><Line name={active.name} dataKey="impedance" stroke="#f19b8d" strokeWidth={2} isAnimationActive={false}/>{comparison&&<Line name={comparison.name} dataKey="comparison" stroke="#67d4df" strokeWidth={2} connectNulls={false} isAnimationActive={false}/>}</LineChart></ResponsiveContainer></div><p>{story.frequencyMeaning}</p><details className="report-detail"><summary>How the frequency slope is calculated</summary><p>{story.slopeMeaning}</p></details><p className="dp-note">Horizontal: frequency (kHz). Vertical: impedance (Ω). {comparison?"Comparison uses exactly matching frequencies; missing points are not filled in. Differences can reflect electrode placement and acquisition conditions. Downloads contain the selected session; comparison is for on-screen review.":"A line joins the available samples to help follow the response; no unmeasured values are added to the table."}</p></article>
<article className="dp-card rp-section report-prose"><h2>02 · What the Cole–Cole plot means</h2><p>{story.cole}</p><ColePlot samples={summary.sorted} fit={fit}/><p>{story.agreement}</p>{fit.ok&&fit.warnings.map(w=><p className="dp-note" key={w}>{w}</p>)}</article>
      <article className="dp-card rp-section report-prose"><h2>03 · How we fitted the curve</h2><p>{story.method}</p><ol className="report-steps"><li><strong>Keep the readings.</strong> Use received R and X at each frequency; at least six unique frequencies are required.</li><li><strong>Find the closest curve.</strong> Adjust the resistance limits, peak frequency and shape within physically constrained bounds.</li><li><strong>Check the differences.</strong> Compare predicted and received R and X. A small error supports the curve's numerical agreement, not a medical diagnosis.</li></ol><details className="report-detail"><summary>Fitted values and technical method</summary><ColeFitDetails fit={fit}/></details></article>
      {active.composition&&<article className="dp-card rp-section report-prose"><h2>04 · Body composition in context</h2><p className="report-result-label">{active.composition.randomInputs?"Example estimates from generated ESP32 readings":"Calculated estimates"}</p>{compositionReportStory(active.composition).map(line=><p key={line}>{line}</p>)}<details className="report-detail"><summary>What the composition estimates mean</summary><CompositionMeaning record={active.composition}/></details><details className="report-detail"><summary>Composition equations and calculation steps</summary><ol>{compositionLines(active.composition).filter(line=>!line.startsWith("Assumed electrode placement:")).map(line=><li key={line}>{line}</li>)}</ol></details></article>}
      <article className="dp-card rp-section report-prose"><h2>Overall interpretation</h2><p>{story.conclusion}</p><p className="dp-note">The shape and slope summarize the electrical path over this frequency band. They do not independently prove normal cells, membrane damage, dehydration or a disease.</p></article>
      <details className="dp-card rp-section report-appendix"><summary>Technical appendix · received readings</summary><div className="data-table-wrap"><table className="bis-data-table"><thead><tr><th>Frequency</th><th>R</th><th>X</th><th>|Z|</th><th>Phase</th>{comparison&&<th>Δ |Z|</th>}</tr></thead><tbody>{summary.sorted.map((m,i)=>{const other=comparison?.samples.find(n=>n.frequency===m.frequency);return <tr key={i}><td>{m.frequency/1000} kHz</td><td>{m.resistance.toFixed(3)} Ω</td><td>{m.reactance.toFixed(3)} Ω</td><td>{m.impedance.toFixed(3)} Ω</td><td>{m.phase.toFixed(3)}°</td>{comparison&&<td>{other?`${(m.impedance-other.impedance).toFixed(3)} Ω`:"No match"}</td>}</tr>;})}</tbody></table></div></details>
      <details className="dp-card rp-section report-appendix"><summary>Methods and evidence</summary><ul className="report-sources"><li><a href="https://pubmed.ncbi.nlm.nih.gov/16868350/" target="_blank" rel="noreferrer">Cole model fitting</a></li>{active.composition&&MODEL_SOURCES.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul></details>
      </>}
    </div></div>
  </section>;
}










