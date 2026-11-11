import type { BISSample } from "./bis";
import type { CompositionRecord } from "./composition";
import { fitCole, colePoint, type ColeFit } from "./cole";

export const CLINICAL_SOURCES = [
  {name:"Cole parameter fitting: nonlinear model",url:"https://pubmed.ncbi.nlm.nih.gov/16868350/"},
  {name:"Phase angle: population and device-specific references",url:"https://pubmed.ncbi.nlm.nih.gov/16804128/"},
  {name:"Published phase-angle examples: Colombia, 2026",url:"https://www.nature.com/articles/s41430-026-01744-z"},
  {name:"Adult BMI categories: CDC",url:"https://www.cdc.gov/bmi/adult-calculator/"},
  {name:"Janssen 2000: skeletal muscle compared with MRI",url:"https://pubmed.ncbi.nlm.nih.gov/10926627/"},
  {name:"EWGSOP2: muscle strength and sarcopenia assessment",url:"https://pubmed.ncbi.nlm.nih.gov/30312372/"},
];

export function adultBMI(height:string|number,weight:string|number,age?:number) {
  const h=Number(height),w=Number(weight);
  if(!Number.isFinite(h)||!Number.isFinite(w)||h<=0||w<=0)return null;
  const value=w/(h/100)**2;
  const category=age!==undefined && age>=20 ? value<18.5?"Underweight":value<25?"Healthy-weight BMI range":value<30?"Overweight":"Obesity BMI range" : null;
  return {value,category,reference:"Adult BMI: <18.5 underweight; 18.5–<25 healthy-weight range; 25–<30 overweight; ≥30 obesity range."};
}

export function muscleEstimate(record:CompositionRecord) {
  const p=record.profile;
  if(p.age<18||p.age>86)return {ok:false as const,reason:"The Janssen muscle equation was studied at ages 18–86; this profile is outside that range."};
  const mass=.401*p.height*p.height/record.input.resistance50+3.825*(p.sex==="male"?1:0)-.071*p.age+5.102;
  if(!Number.isFinite(mass)||mass<=0||mass>=record.output.fatFreeMass)return {ok:false as const,reason:"These inputs do not produce a plausible muscle compartment. No muscle value is shown."};
  return {ok:true as const,mass,index:mass/(p.height/100)**2,
    formula:"Skeletal muscle (kg) = 0.401 × height²/R50 + 3.825 × sex − 0.071 × age + 5.102; height in cm, male=1, female=0.",
    explanation:`The Janssen model estimates ${mass.toFixed(1)} kg of skeletal muscle. It was compared with MRI in adults, with a study standard error of 2.7 kg; that is not an individual confidence interval. The original equation underestimated muscle in Asian participants.`,
  };
}

export function compositionInsights(record:CompositionRecord) {
  const bmi=adultBMI(record.profile.height,record.profile.weight,record.profile.age)!;
  const muscle=muscleEstimate(record);
  const lines=[
    `Your entered height and weight give a BMI of ${bmi.value.toFixed(1)}: ${bmi.category}. This is a weight-for-height screening category, not a direct measurement of fat or a diagnosis. Pregnancy, muscular build and clinical context can change its usefulness.`,
    `Estimated fat is ${record.output.fatPercent.toFixed(1)}% (${record.output.fatMass.toFixed(1)} kg), using Kyle 2001. Fat mass is body weight minus estimated fat-free mass. The app does not label this percentage healthy or unhealthy because no applicable age-, sex- and population-specific fat reference has been selected.`,
    `Estimated body water is ${record.output.waterLitres.toFixed(1)} L (${record.output.waterPercent.toFixed(1)}%), using Sun 2003. This does not by itself establish dehydration or fluid overload.`,
    muscle.ok?muscle.explanation:muscle.reason,
    "Fat-free mass includes water, organs and bone as well as muscle. Water and muscle are parts of fat-free mass, so these percentages must not be added together.",
    "Muscle quantity alone cannot establish strength or diagnose sarcopenia. Clinical assessment also considers grip strength or chair-rise performance and, when needed, walking performance (EWGSOP2).",
  ];
  return {bmi,muscle,lines,context:record.randomInputs?"Example model outputs from simulated ESP32 data; they are not measurements of your body.":"Model estimates require validation for the device and measurement protocol."};
}

export const TERM_GUIDE = [
  {term:"Resistance (R)",meaning:"Opposition to current flow through the electrical path between electrodes. Tissue fluids, body geometry and contact conditions affect it.",availability:"Recorded at each frequency; no universal healthy range in ohms."},
  {term:"Reactance (X / Xc)",meaning:"The capacitive part of the electrical response. This app retains signed X; clinical Xc often means its positive magnitude.",availability:"Recorded at each frequency; not a direct measure of the number of healthy cells."},
  {term:"Impedance (|Z|)",meaning:"Combined resistance and reactance: √(R² + X²).",availability:"Recorded or calculated by the acquisition pipeline."},
  {term:"Phase angle (PhA)",meaning:"The angle between voltage and current. Capacitive signed phase may be negative; a clinical positive convention uses atan2(−X,R).",availability:"Reference comparisons require matching frequency, device, population and protocol."},
  {term:"R₀ / extracellular resistance Re",meaning:"The Cole model's resistance at the theoretical zero-frequency limit, associated with the extracellular path in a simplified circuit.",availability:"Extrapolated estimate, not a measurement at zero frequency."},
  {term:"R∞",meaning:"The Cole model's theoretical high-frequency resistance, representing parallel extracellular and intracellular paths.",availability:"Extrapolated estimate; the highest recorded frequency is not infinity."},
  {term:"Intracellular resistance Ri",meaning:"An equivalent-circuit estimate: R₀ × R∞ / (R₀ − R∞).",availability:"Derived from the model, not measured inside a cell."},
  {term:"Characteristic frequency fc",meaning:"The fitted frequency of maximum reactance magnitude. It need not be the frequency of maximum phase angle.",availability:"Reliable estimation requires a sweep that captures the peak."},
  {term:"Relaxation time τ",meaning:"The model's electrical timescale, τ = 1/(2πfc).",availability:"Calculated from the fitted fc."},
  {term:"Dispersion exponent α",meaning:"Controls the broadening of the Cole arc. This app uses the exponent α in (j f/fc)^α; α=1 is the ideal single-time-constant case.",availability:"Model parameter, not a cell-health score; other software may use 1−α."},
  {term:"Membrane capacitance Cm",meaning:"An effective electrical-circuit property, not the capacitance of an individual cell.",availability:"Shown only for a close, near-ideal α=1 fit; generalized Cole fits do not identify a unique ideal capacitor here."},
  {term:"RMSE / model agreement",meaning:"Root-mean-square error describes how far fitted R and X lie from the received values.",availability:"Small error means close numerical agreement; it does not validate the instrument or prove health."},
  {term:"TBW / ECW / ICW",meaning:"Total body water, water outside cells and water inside cells. In compartment models, TBW = ECW + ICW.",availability:"The current composition flow estimates TBW; it does not estimate separate ECW or ICW volumes."},
  {term:"ECW/TBW and ECW/ICW",meaning:"Ratios describing how water is distributed between compartments.",availability:"Unavailable without a validated fluid-compartment model."},
  {term:"Overhydration / edema / dehydration",meaning:"Excess fluid, interstitial fluid accumulation and water deficit are related but different clinical conditions.",availability:"Not diagnosed from this sweep or a water percentage alone."},
  {term:"BIVA / tolerance ellipse",meaning:"A reference-based plot of height-normalized R and Xc, usually at a specified single frequency.",availability:"Not the same as a multifrequency Cole plot; no matched BIVA reference ellipse is implemented."},
  {term:"Standardized phase angle / percentile",meaning:"A comparison with a matched population's mean and spread or percentile distribution.",availability:"Not calculated without an applicable reference dataset."},
  {term:"FM / FFM / FFMI",meaning:"Fat mass, fat-free mass and fat-free mass divided by height squared.",availability:"FM and FFM use Kyle 2001 in this app. FFM is not skeletal muscle."},
  {term:"SMM / SMI / ASM",meaning:"Total skeletal muscle, total skeletal muscle divided by height squared, and appendicular (limb) skeletal muscle are distinct quantities.",availability:"SMM and total SMI use Janssen 2000; ASM is not estimated."},
  {term:"BCM / BCMI / ECM",meaning:"Body cell mass, body cell mass index and extracellular mass are specialized compartment-model outputs.",availability:"Not estimated by the current equations; no cell count is measured."},
  {term:"Sarcopenia / malnutrition / cachexia",meaning:"Clinical conditions involving muscle function, nutritional deficiency or disease-related wasting, respectively.",availability:"These need clinical assessment and are not diagnosed by the app."},
];

export type ComparisonRow={quantity:string;value:string;reference:string;meaning:string};
export function sweepInterpretation(input:{samples:BISSample[];simulated:boolean;height:string;weight:string;composition?:CompositionRecord},fit:ColeFit=fitCole(input.samples)) {
  const sorted=[...input.samples].filter(s=>[s.frequency,s.resistance,s.reactance].every(Number.isFinite)&&s.frequency>0).sort((a,b)=>a.frequency-b.frequency);
  const exact=sorted.filter(s=>s.frequency===50000);
  const phaseSample=exact.length===1?exact[0]:fit.ok&&fit.quality==="close"&&fit.minFrequency<=50000&&fit.maxFrequency>=50000?colePoint(fit.parameters,50000):null;
  const phase50=phaseSample&&phaseSample.resistance>0&&phaseSample.reactance<=0?Math.atan2(-phaseSample.reactance,phaseSample.resistance)*180/Math.PI:null;
  const phaseMethod=exact.length===1?"from received R and X at 50 kHz":"Cole-model estimate at 50 kHz";
  const comparisons:ComparisonRow[]=[
    {quantity:"Phase angle at 50 kHz",value:phase50===null?"Unavailable":`${phase50.toFixed(2)}° · ${phaseMethod}`,
      reference:"Published example only: healthy Colombian adults aged 20–29, median 7.6° for males and 6.5° for females; seated, hand-to-foot, BiodyXpert ZM II (Carrera-Gil 2026).",
      meaning:"These are population medians, not healthy/unhealthy cutoffs or a personal reference interval. Your ESP32, posture and population have not been validated against that study. No clinical classification is made."},
    {quantity:"Resistance and reactance",value:sorted.length?`${sorted.length} frequency-specific readings`:"Unavailable",reference:"No universal clinical interval in ohms.",meaning:"Body size, electrode location, frequency and device all affect the result."},
    {quantity:"Cole parameters",value:fit.ok?`${fit.quality==="close"?"Close":"Limited"} numerical agreement`:"Not fitted",reference:"Physical model: R₀ > R∞ > 0; 0.1 ≤ α ≤ 1 in this solver.",meaning:"These are model constraints, not medical normal ranges. Extrapolated parameters cannot directly classify cell health."},
    {quantity:"ECW / ICW / cell health",value:"Not estimated",reference:"A validated fluid model and appropriate clinical references are required.",meaning:"A fitted curve alone does not establish fluid volumes, membrane damage or a disease diagnosis."},
  ];
  const lines=[input.simulated?"This is a demonstration using generated ESP32 values. It cannot tell you whether your cells or hydration are healthy.":"This report describes the electrical path between the electrodes. Clinical interpretation requires a validated device and matching protocol."];
  if(fit.ok){lines.push(`The fitted curve ${fit.quality==="close"?"follows the points closely":"has limitations"}: its combined R/X error is ${fit.rmse.toFixed(2)} Ω (${fit.relativeErrorPercent.toFixed(2)}% of mean impedance). The 2% agreement rule is an engineering check chosen by this app, not a clinical standard.`);lines.push("The line is fitted only over the recorded frequency band. R₀ and R∞ are extrapolated limits, not additional received samples.");lines.push(...fit.warnings);}else lines.push(fit.reason);
  return {fit,phase50,phaseMethod,comparisons,lines,terms:TERM_GUIDE,sources:CLINICAL_SOURCES};
}
