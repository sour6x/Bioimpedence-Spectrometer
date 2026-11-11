import type { CompositionRecord } from "@/lib/composition";
import { compositionInsights, sweepInterpretation } from "@/lib/interpretation";
import { COLE_METHOD, type ColeFit } from "@/lib/cole";
import type { BISSample } from "@/lib/bis";

export function CompositionMeaning({record}:{record:CompositionRecord}) {
  const insight=compositionInsights(record);
  return <section className="result-meaning"><h3>What these results mean</h3><p className="result-context">{insight.context}</p>
    <div className="meaning-highlight"><span>BMI weight category</span><strong>{insight.bmi.category}</strong><p>BMI {insight.bmi.value.toFixed(1)} · based on the height and weight you entered.</p></div>
    {insight.lines.map(line=><p key={line}>{line}</p>)}
    <details><summary>How the reference comparison works</summary><p>{insight.bmi.reference} These adult BMI categories are from CDC. They describe weight relative to height, not fat percentage.</p>
      <p>Fat and water use the existing Kyle 2001 and Sun 2003 equations. Muscle uses Janssen 2000 and is a different compartment from fat-free mass.</p>
      {insight.muscle.ok&&<><p>{insight.muscle.formula}</p><p>R50 is {record.input.resistance50.toFixed(2)} Ω, {record.input.method==="received"?"received at 50 kHz":"linearly interpolated between received frequencies"}. Total muscle index is {insight.muscle.index.toFixed(2)} kg/m². It is not appendicular muscle index.</p></>}
      <p>No generic fat or muscle percentage has been used to label you healthy or unhealthy. Such a judgment needs an appropriate reference and clinical assessment.</p>
      <ul><li><a href="https://www.cdc.gov/bmi/adult-calculator/" target="_blank" rel="noreferrer">Adult BMI reference</a></li><li><a href="https://pubmed.ncbi.nlm.nih.gov/10926627/" target="_blank" rel="noreferrer">Janssen muscle equation and validation</a></li><li><a href="https://pubmed.ncbi.nlm.nih.gov/30312372/" target="_blank" rel="noreferrer">Muscle function assessment: EWGSOP2</a></li></ul>
    </details>
  </section>;
}

export default function ResultMeaning({samples,simulated,height,weight,composition,mode="all",fit}:{mode?:"all"|"summary"|"reference"|"terms";fit?:ColeFit;samples:BISSample[];simulated:boolean;height:string;weight:string;composition?:CompositionRecord}) {
  const analysis=sweepInterpretation({samples,simulated,height,weight,composition},fit);
  return <>
    {(mode==="all"||mode==="summary")&&<article className="dp-card rp-section result-meaning"><h2>Your result, explained</h2>
      <div className="meaning-highlight"><span>{simulated?"Demonstration session":"Electrical measurement session"}</span><strong>{simulated?"These are test values, not a body assessment":analysis.fit.ok?"Your sweep has been analysed":"More or better-quality readings are needed"}</strong></div>
      {analysis.lines.map(line=><p key={line}>{line}</p>)}
      <h3>How to read the graph</h3><p>Each dot is an electrical reading at a different frequency. The line is the best-fitting Cole model. A close fit explains the shape of the electrical response; it does not prove that cells are healthy or damaged.</p>
    </article>}
    {(mode==="all"||mode==="reference")&&<article className="dp-card rp-section result-meaning"><h2>Your values and reference context</h2><p>There is no single clinical normal range for every bioimpedance value. The table explains what can be compared and where a personal conclusion would be unsupported.</p>
      <div className="data-table-wrap"><table className="bis-data-table"><thead><tr><th>Quantity</th><th>Your session</th><th>Reference</th><th>Meaning</th></tr></thead><tbody>{analysis.comparisons.map(row=><tr key={row.quantity}><th scope="row">{row.quantity}</th><td>{row.value}</td><td>{row.reference}</td><td>{row.meaning}</td></tr>)}</tbody></table></div>
    </article>}
    {(mode==="all"||mode==="terms")&&<article className="dp-card rp-section result-meaning"><h2>Understand the terms</h2><p>Open any term for its meaning and whether this app can provide it.</p>{analysis.terms.map(item=><details className="term-entry" key={item.term}><summary>{item.term}</summary><p>{item.meaning}</p><p><strong>In this app:</strong> {item.availability}</p></details>)}
      <details className="term-entry"><summary>Methods and evidence</summary><p>{COLE_METHOD}</p><ul>{analysis.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul></details>
    </article>}
  </>;
}

