"use client";
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { BISSample } from "@/lib/bis";
import { coleCurve, COLE_METHOD, type ColeFit } from "@/lib/cole";

export function coleParameterRows(fit:ColeFit) {
  if(!fit.ok)return [];
  const p=fit.parameters;
  return [["R₀",`${p.r0.toFixed(2)} Ω`],["R∞",`${p.rInfinity.toFixed(2)} Ω`],["Ri",`${fit.ri.toFixed(2)} Ω`],["fc",`${(p.fc/1000).toFixed(2)} kHz`],["α",p.alpha.toFixed(4)],["τ",`${(fit.tau*1e6).toFixed(2)} µs`],["Ideal-RC Cm",fit.capacitanceNF===null?"Not identified for this fit":`${fit.capacitanceNF.toFixed(2)} nF`],["Combined R/X RMSE",`${fit.rmse.toFixed(3)} Ω`]];
}

export function ColeFitDetails({fit}:{fit:ColeFit}) {
  if(!fit.ok)return <p className="dp-note" role="status">{fit.reason}</p>;
  return <><p className="dp-note">{fit.quality==="close"?"The line follows the received points closely.":"The fitted curve has limitations."} Error: {fit.rmse.toFixed(2)} Ω ({fit.relativeErrorPercent.toFixed(2)}%). Numerical agreement does not establish medical accuracy.</p>
    {fit.warnings.map(warning=><p className="dp-note" key={warning}>{warning}</p>)}
    <details className="cole-details"><summary>Model values and fitting method</summary><div className="cole-parameters">{coleParameterRows(fit).map(([name,value])=><div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>
      <p className="dp-note">Z(f) = R∞ + (R₀ − R∞) / [1 + (j f/fc)^α]. {COLE_METHOD}. R and X receive equal weight. Six unique frequencies are required. A relative error over 2% is flagged by this app as an engineering check, not a clinical cutoff.</p>
      <p className="dp-note">R₀ and R∞ are extrapolated. No tissue water volume is inferred from these parameters. Cm is reported only for a close, near-ideal α=1 fit; otherwise an ideal capacitor is not uniquely identified.</p>
    </details></>;
}

function PointTooltip({active,payload}:{active?:boolean;payload?:Array<{payload?:BISSample&{fitted?:boolean}}>}) {
  const point=payload?.[0]?.payload;if(!active||!point)return null;
  return <div className="dp-tooltip"><strong>{point.fitted?"Fitted":"Received"} · {(point.frequency/1000).toFixed(2)} kHz</strong><div>R: {point.resistance.toFixed(2)} Ω</div><div>X: {point.reactance.toFixed(2)} Ω</div><div>|Z|: {point.impedance.toFixed(2)} Ω</div></div>;
}

export default function ColePlot({samples,fit,highlightFrequency}:{samples:BISSample[];fit:ColeFit;highlightFrequency?:number}) {
  const curve=coleCurve(fit).map(s=>({...s,negativeReactance:-s.reactance,fitted:true}));
  const raw=samples.map(s=>({...s,negativeReactance:-s.reactance}));
  return <><div className="dp-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:20,right:24,bottom:24,left:12}}>
    <CartesianGrid stroke="var(--border)"/><XAxis type="number" dataKey="resistance" name="Resistance" unit=" Ω" domain={["auto","auto"]} tick={{fill:"var(--muted)",fontSize:11}}/>
    <YAxis type="number" dataKey="negativeReactance" name="−Reactance" unit=" Ω" domain={["auto","auto"]} tick={{fill:"var(--muted)",fontSize:11}}/>
    <Tooltip content={<PointTooltip/>}/><Legend wrapperStyle={{fontSize:10}}/>
    {curve.length>0&&<Scatter name="Fitted Cole curve" data={curve} fill="#f2b3a5" line={{stroke:"#f2b3a5",strokeWidth:2}} shape={()=><g/>} isAnimationActive={false}/>}
    <Scatter name="Received samples" data={raw.filter(s=>s.frequency!==highlightFrequency)} fill="#bfa4b0" isAnimationActive={false}/>
    {highlightFrequency!==undefined&&<Scatter name="Selected frequency" data={raw.filter(s=>s.frequency===highlightFrequency)} fill="#fff1e9" isAnimationActive={false}/>}
  </ScatterChart></ResponsiveContainer></div><p className="dp-axis-note">Dots are received readings; the line is a fitted model over the recorded band. Horizontal: R (Ω). Vertical: −X (Ω).</p></>;
}
