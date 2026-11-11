import type {SweepReport} from "./reports";
import {fitCole,type ColeFit} from "./cole";
import type {CompositionRecord} from "./composition";
import {compositionInsights} from "./interpretation";

export function compositionReportStory(record:CompositionRecord) {
  const insight=compositionInsights(record),o=record.output;
  return [
    `Your entered height and weight give a BMI of ${insight.bmi.value.toFixed(1)}${insight.bmi.category?`, in the ${insight.bmi.category.toLowerCase()} category`:""}. This describes weight relative to height; it does not measure body fat.`,
    `The Kyle model estimates ${o.fatPercent.toFixed(1)}% body fat, equivalent to ${o.fatMass.toFixed(1)} kg. The remaining ${o.fatFreeMass.toFixed(1)} kg is fat-free mass, which includes muscle, water, organs and bone. No matched fat-percentage reference has been selected, so this estimate is not labelled high or low.`,
    `The Sun model estimates ${o.waterLitres.toFixed(1)} L of body water (${o.waterPercent.toFixed(1)}% of body weight). This is a total-water estimate, not evidence of dehydration or fluid overload.`,
    insight.muscle.ok?`The Janssen model estimates ${insight.muscle.mass.toFixed(1)} kg of skeletal muscle. This is part of fat-free mass, not an additional compartment to add to it. The equation was compared with MRI in adults, but this instrument and session have not been validated for clinical muscle assessment. Muscle strength and a suitable reference are needed before describing muscle as low or adequate.`:insight.muscle.reason,
  ];
}

export function reportStory(report:SweepReport,fit:ColeFit=fitCole(report.samples)) {
  const points=report.samples.filter(s=>[s.frequency,s.impedance,s.resistance,s.reactance].every(Number.isFinite)&&s.frequency>0).slice().sort((a,b)=>a.frequency-b.frequency);
  const first=points[0],last=points.at(-1);
  const hasTrend=points.length>1&&last!.frequency>first!.frequency;
  const change=hasTrend?last!.impedance-first!.impedance:null;
  const percent=change!==null&&first!.impedance>0?100*change/first!.impedance:null;
  const slope=change!==null?change/Math.log10(last!.frequency/first!.frequency):null;
  const turns=points.slice(1).filter((s,i)=>s.impedance>points[i].impedance+.01).length;
  const falling=change!==null&&change<0;
  const frequency=hasTrend?`Across ${first!.frequency/1000}–${last!.frequency/1000} kHz, impedance ${change===0?"was unchanged":falling?"fell":"rose"} from ${first!.impedance.toFixed(1)} Ω to ${last!.impedance.toFixed(1)} Ω${percent===null?"":` (${Math.abs(percent).toFixed(1)}% ${falling?"lower":"higher"})`}. ${change===0?"The endpoints were equal.":falling&&turns===0?"Every received step followed a downward trend.":"The response was not a steady decline at every frequency."}`:"More than one distinct frequency is needed to describe a trend.";
  const frequencyMeaning=falling?"A lower impedance at higher frequencies is compatible with a capacitive electrical response: in a simplified tissue circuit, membranes oppose low-frequency current more strongly and allow a greater contribution from intracellular paths at higher frequencies. This pattern alone cannot establish membrane health or a water compartment volume.":"The direction and shape describe the electrical response between the electrodes. Contact, calibration, geometry and the suitability of the circuit model must be considered before attributing the pattern to tissue.";
  const slopeMeaning=slope===null?"No frequency slope is available yet.":`The average endpoint slope is ${slope.toFixed(1)} Ω per tenfold increase in frequency. It is calculated as (last |Z| − first |Z|) / log₁₀(last frequency / first frequency). It summarizes this band; it is not a straight-line fit, a rate of change over time or a clinical score.`;
  const cole=fit.ok?`The Cole curve describes the relationship between resistance and capacitive reactance across the sweep. Its fitted reactance peak is at ${(fit.parameters.fc/1000).toFixed(1)} kHz${fit.parameters.fc<fit.minFrequency||fit.parameters.fc>fit.maxFrequency?", outside the recorded band":", within the recorded band"}. The dispersion exponent α is ${fit.parameters.alpha.toFixed(3)}; a value below 1 broadens the ideal semicircular response. It is a shape parameter, not a cell-health percentage.`:fit.reason;
  const method="We fitted the complex Cole equation to the received resistance and signed reactance together. The solver tries multiple starting points for the peak frequency and arc shape, solves the resistance terms, then adjusts the parameters to minimize the sum of squared differences between the curve and the readings. R and X have equal weight. The smooth line is the fitted model; dots remain the received samples.";
  const agreement=fit.ok?`The combined R/X fitting error is ${fit.rmse.toFixed(2)} Ω (${fit.relativeErrorPercent.toFixed(2)}% of the mean impedance). ${fit.quality==="close"?"The model follows these points closely.":"The fit has limitations, so its parameters need extra caution."} Numerical agreement describes the fit, not the accuracy of the instrument or a medical outcome.`: "A fitted interpretation is unavailable. The received points remain visible; the app does not invent a replacement curve.";
  const pattern=!hasTrend?"The sweep is not yet sufficient to describe its frequency response.":change===0?"The endpoint impedance is unchanged across the sweep.":falling&&turns===0?"Impedance decreases as frequency increases, demonstrating a frequency-dependent electrical response.":`The endpoint impedance is ${falling?"lower":"higher"} at the higher frequency, with variation across the intermediate readings.`;
  const match=fit.ok?fit.quality==="close"?"A single Cole arc closely describes the received R and X values.":"A single Cole arc has limitations in describing these readings.":"The data do not yet support a fitted Cole interpretation.";
  const conclusion=`${pattern} ${match} ${report.simulated?"This is a simulation using generated ESP32 values, not a body assessment.":"Clinical interpretation requires a validated instrument, consistent protocol and an applicable reference population."}`;
  return {points,change,percent,slope,frequency,frequencyMeaning,slopeMeaning,cole,method,agreement,conclusion,fit};
}

