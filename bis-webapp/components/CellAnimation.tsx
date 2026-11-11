"use client";

import { useId, useState, type CSSProperties } from "react";
import "./CellAnimation.css";

export default function CellAnimation({frequency}:{frequency?:number}) {
  const [paused,setPaused]=useState(false);
  const [focus,setFocus]=useState<"membrane"|"outside"|"inside">("membrane");
  const gradient=useId().replace(/:/g,"");
  const active=typeof frequency==="number"&&Number.isFinite(frequency)&&frequency>0;
  const relative=active?Math.max(0,Math.min(1,Math.log(frequency/4000)/Math.log(30))):0;
  const copy={membrane:"A cell membrane separates the interior from its surroundings. Its capacitive electrical response helps explain why impedance can vary with frequency.",outside:"The orange path illustrates current around the cells. This is a conceptual pathway, not a reconstruction of current inside your body.",inside:"The blue path illustrates a pathway through cell interiors. Higher frequency can change how membranes affect the response; this drawing does not measure intracellular current."};
  return <article className={`dp-card ca-card ${paused||!active?"ca-paused":""}`} style={{"--ca-speed":`${3.2-relative*1.4}s`} as CSSProperties} aria-labelledby={`${gradient}-title`}>
    <div className="dp-card-heading"><div><div className="small-label">CELLULAR PATHWAYS</div><h2 id={`${gradient}-title`}>Follow the signal through cells</h2></div><button className="secondary-button" disabled={!active} onClick={()=>setPaused(!paused)}>{!active?"Awaiting frequency":paused?"Play animation":"Pause animation"}</button></div>
    <div className="ca-context">{active?`${(frequency/1000).toFixed(1)} kHz · follows your selected received sample`:"Waiting for a received frequency to animate"}</div>
    <svg viewBox="0 0 720 350" className="ca-scene" role="img" aria-label={`Cell membrane and current-path illustration${active?` at ${frequency/1000} kilohertz`:", waiting for samples"}`}>
      <defs><radialGradient id={gradient}><stop stopColor="#ff9b42" stopOpacity=".18"/><stop offset="1" stopColor="#ff7a18" stopOpacity=".02"/></radialGradient></defs>
      <g stroke="var(--border)" strokeWidth="1"><path d="M25 70H695M25 280H695" strokeDasharray="4 10"/></g>
      {[190,360,530].map((cx,i)=><g key={cx}><ellipse className="ca-membrane" cx={cx} cy="176" rx="69" ry="84" fill={`url(#${gradient})`} stroke="#ff9b42" strokeWidth={focus==="membrane"?3:1.5}/><ellipse cx={cx} cy="176" rx="61" ry="76" fill="none" stroke="#ff9b42" strokeOpacity=".22"/><circle cx={cx+(i%2?-9:8)} cy="180" r="22" fill="#ff7a18" fillOpacity=".12" stroke="#ff9b42" strokeOpacity=".4"/><circle cx={cx-25} cy="145" r="7" fill="#ff9b42" opacity=".3"/><ellipse cx={cx+24} cy="210" rx="10" ry="5" fill="#ff9b42" opacity=".3"/></g>)}
      <g fill="none" stroke="#ffa24b" strokeWidth="3" opacity={focus==="inside"?.25:active?1-relative*.35:.35}><path d="M30 150H80C120 150 105 65 190 65S270 150 285 150C300 150 275 65 360 65S440 150 455 150C470 150 445 65 530 65S610 150 640 150H690" opacity=".22"/><path className="ca-stream" strokeLinecap="round" strokeDasharray="2 17" d="M30 150H80C120 150 105 65 190 65S270 150 285 150C300 150 275 65 360 65S440 150 455 150C470 150 445 65 530 65S610 150 640 150H690"/><path className="ca-stream" strokeLinecap="round" strokeDasharray="2 17" d="M30 220H80C120 220 105 285 190 285S270 220 285 220C300 220 275 285 360 285S440 220 455 220C470 220 445 285 530 285S610 220 640 220H690"/></g>
      <g fill="none" stroke="#67d4df" strokeWidth="3" opacity={focus==="outside"?.18:active?.15+relative*.85:.15}><path d="M30 166H690M30 194H690" opacity=".16"/><path className="ca-stream ca-stream-inner" strokeLinecap="round" strokeDasharray="2 17" d="M30 166H690M30 194H690"/></g>
      <g fill="var(--muted)" fontSize="12"><text x="30" y="327">Orange · around cells</text><text x="500" y="327">Blue · through cells</text></g>
    </svg>
    <div className="ca-controls" aria-label="Explore cell structures">{(["membrane","outside","inside"] as const).map(item=><button key={item} aria-pressed={focus===item} onClick={()=>setFocus(item)}>{item==="membrane"?"Cell membrane":item==="outside"?"Outside the cells":"Inside the cells"}</button>)}</div>
    <div className="ca-explanation" aria-live="polite">{copy[focus]}</div>
    <p className="dp-note">Schematic pathways only. Movement is slowed for display and changes with the selected frequency; it is not a measurement of cell activity or current distribution.</p>
  </article>;
}

