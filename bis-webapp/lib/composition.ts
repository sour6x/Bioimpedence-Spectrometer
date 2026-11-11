import type { BISSample } from "./bis";
import { muscleEstimate } from "./interpretation";
export type PredictionProfile={age:string;sex:""|"male"|"female";layout:"whole-body"|"arm"|"leg"|"custom";allowInterpolation:boolean};
export const DEFAULT_PREDICTION:PredictionProfile={age:"",sex:"",layout:"whole-body",allowInterpolation:true};
export const LAYOUT_NAMES={"whole-body":"Right hand–right foot · four electrodes · supine",arm:"Arm segment · four electrodes",leg:"Leg segment · four electrodes",custom:"Custom electrode layout"};
export const MODEL_SOURCES=[{name:"Janssen et al. (2000): skeletal muscle equation",url:"https://pubmed.ncbi.nlm.nih.gov/10926627/"},{name:"Kyle et al. (2001): fat-free mass equation",url:"https://pubmed.ncbi.nlm.nih.gov/11312069/"},{name:"Sun et al. (2003): total body water equation",url:"https://pubmed.ncbi.nlm.nih.gov/12540391/"},{name:"Published application of the water equations",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC2877506/"}];
export type CompositionRecord={version:1;signature:string;calculatedAt:string;randomInputs:true;profile:{height:number;weight:number;age:number;sex:"male"|"female";layout:"whole-body"};input:{method:"received"|"interpolated";resistance50:number;reactance50:number;lowerFrequency:number;upperFrequency:number;lowerR:number;upperR:number;lowerX:number;upperX:number;fraction:number};output:{fatFreeMass:number;fatMass:number;fatPercent:number;waterLitres:number;waterPercent:number}};
export function compositionSignature(samples:BISSample[],height:string,weight:string,profile:PredictionProfile,randomInputs:boolean){return JSON.stringify({samples,height,weight,profile,randomInputs});}
export function calculateComposition(samples:BISSample[],height:string,weight:string,profile:PredictionProfile,randomInputs:boolean):{ok:true;record:CompositionRecord}|{ok:false;reasons:string[]} {
  const reasons:string[]=[];const h=Number(height),w=Number(weight),age=Number(profile.age);
  if(!Number.isFinite(h)||!Number.isFinite(w)||h<=0||w<=0)reasons.push("Enter valid height in centimetres and weight in kilograms.");
  if(!Number.isFinite(age)||age<22||age>94)reasons.push("Enter an age from 22 to 94, the common adult range used for this calculation flow.");
  if(profile.sex!=="male"&&profile.sex!=="female")reasons.push("Choose the male or female coefficient required by the published equations.");
  if(profile.layout!=="whole-body")reasons.push("These whole-body equations cannot convert arm, leg or custom electrode readings into whole-body fat or water percentages. Choose the hand-to-foot layout for this exercise.");
  if(!randomInputs)reasons.push("This calculation flow is currently limited to the ESP32 random-input exercise. Real readings require device and protocol validation.");
  const bmi=w/(h/100)**2;if(Number.isFinite(bmi)&&(bmi<17||bmi>33.8))reasons.push("The profile BMI must be within 17.0–33.8, the Kyle study range.");
  const valid=samples.every(s=>s.frequency>0&&[s.frequency,s.resistance,s.reactance,s.impedance,s.phase].every(Number.isFinite));
  if(!valid)reasons.push("The sweep contains non-finite or invalid frequency values.");
  const direct=samples.filter(s=>s.frequency===50000);let input:CompositionRecord["input"]|undefined;
  if(direct.length>1)reasons.push("Multiple 50 kHz samples are ambiguous; start a fresh sweep.");
  else if(direct.length===1){const p=direct[0];input={method:"received",resistance50:p.resistance,reactance50:p.reactance,lowerFrequency:50000,upperFrequency:50000,lowerR:p.resistance,upperR:p.resistance,lowerX:p.reactance,upperX:p.reactance,fraction:0};}
  else if(!profile.allowInterpolation)reasons.push("No 50 kHz sample was received. Enable the explicit interpolation option or use firmware that sends 50 kHz.");
  else {const sorted=[...samples].sort((a,b)=>a.frequency-b.frequency),lower=sorted.filter(s=>s.frequency<50000).at(-1),upper=sorted.find(s=>s.frequency>50000);if(!lower||!upper)reasons.push("Receive frequencies on both sides of 50 kHz before calculating; values are never extrapolated.");else if(samples.filter(s=>s.frequency===lower.frequency).length!==1||samples.filter(s=>s.frequency===upper.frequency).length!==1)reasons.push("The bracketing frequencies contain duplicates; start a fresh sweep.");else {const t=(50000-lower.frequency)/(upper.frequency-lower.frequency);input={method:"interpolated",resistance50:lower.resistance+t*(upper.resistance-lower.resistance),reactance50:lower.reactance+t*(upper.reactance-lower.reactance),lowerFrequency:lower.frequency,upperFrequency:upper.frequency,lowerR:lower.resistance,upperR:upper.resistance,lowerX:lower.reactance,upperX:upper.reactance,fraction:t};}}
  if(input&&(!Number.isFinite(input.resistance50)||input.resistance50<=0||!Number.isFinite(input.reactance50)||input.reactance50>0))reasons.push("The model requires positive R50 and signed capacitive reactance X50 ≤ 0; the sign is not silently changed.");
  if(reasons.length||!input)return {ok:false,reasons};
  const index=h*h/input.resistance50,xc=-input.reactance50,male=profile.sex==="male";
  const fatFreeMass=-4.104+.518*index+.231*w+.130*xc+4.229*(male?1:0);
  const fatMass=w-fatFreeMass,fatPercent=fatMass/w*100;
  const waterLitres=male?1.203+.449*index+.176*w:3.747+.450*index+.113*w;
  const waterPercent=waterLitres/w*100;
  if(![fatFreeMass,fatMass,fatPercent,waterLitres,waterPercent].every(Number.isFinite)||fatFreeMass<=0||fatFreeMass>=w||waterLitres<=0||waterLitres>w||waterLitres>fatFreeMass)return {ok:false,reasons:["These random inputs produce incompatible or out-of-range body compartments. Results have not been clamped. Try another ESP32 sweep or check the profile."]};
  return {ok:true,record:{version:1,signature:compositionSignature(samples,height,weight,profile,randomInputs),calculatedAt:new Date().toISOString(),randomInputs:true,profile:{height:h,weight:w,age,sex:profile.sex as "male"|"female",layout:"whole-body"},input,output:{fatFreeMass,fatMass,fatPercent,waterLitres,waterPercent}}};
}
export function compositionLines(record:CompositionRecord):string[]{
  const {profile:p,input:i,output:o}=record,m=p.sex==="male",index=p.height*p.height/i.resistance50;
  const muscle=muscleEstimate(record);
  return [
    "This is a calculation exercise using random electrical values generated by the ESP32. No body tissue, electrode contact or actual body composition was measured.",
    `Assumed electrode placement: ${LAYOUT_NAMES[p.layout]}. I+ at the right hand, V+ at the right wrist, V− at the right ankle and I− at the right foot. This is a schematic assumption; the current firmware generates values independently of the selected layout.`,
    `Profile: height ${p.height} cm, weight ${p.weight} kg, age ${p.age} years, ${p.sex} equation coefficient. Age checks eligibility for fat and water models and is a term in the Janssen muscle equation.`,
    "The firmware generates R and X, calculates |Z| = √(R² + X²) and phase = atan2(X, R) × 180/π, then sends the numbered frequency samples over Bluetooth or its Wi-Fi hotspot. The app performs the body-composition calculations below.",
    i.method==="interpolated"?`No 50 kHz value was sent. Linear interpolation uses ${i.lowerFrequency/1000} kHz (R = ${i.lowerR.toFixed(4)} Ω, X = ${i.lowerX.toFixed(4)} Ω) and ${i.upperFrequency/1000} kHz (R = ${i.upperR.toFixed(4)} Ω, X = ${i.upperX.toFixed(4)} Ω). t = (50000 − ${i.lowerFrequency}) / (${i.upperFrequency} − ${i.lowerFrequency}) = ${i.fraction.toFixed(4)}. R50 = Rlow + t(Rhigh − Rlow) = ${i.resistance50.toFixed(4)} Ω; X50 = Xlow + t(Xhigh − Xlow) = ${i.reactance50.toFixed(4)} Ω. These are estimated inputs, not received 50 kHz measurements.`:`A 50 kHz packet was received: R50 = ${i.resistance50.toFixed(4)} Ω and X50 = ${i.reactance50.toFixed(4)} Ω.`,
    `For the capacitive-reactance magnitude used by Kyle, Xc50 = −X50 = ${(-i.reactance50).toFixed(4)} Ω. Height²/R50 = ${p.height}²/${i.resistance50.toFixed(4)} = ${index.toFixed(4)} cm²/Ω.`,
    `Kyle 2001: fat-free mass = −4.104 + 0.518(height²/R50) + 0.231(weight) + 0.130(Xc50) + 4.229(sex), with male = 1 and female = 0. Substitution: −4.104 + 0.518×${index.toFixed(4)} + 0.231×${p.weight} + 0.130×${(-i.reactance50).toFixed(4)} + 4.229×${m?1:0} = ${o.fatFreeMass.toFixed(2)} kg.`,
    `Fat mass = weight − fat-free mass = ${p.weight} − ${o.fatFreeMass.toFixed(2)} = ${o.fatMass.toFixed(2)} kg. Fat % = fat mass/weight × 100 = ${o.fatPercent.toFixed(2)}%.`,
    `Sun 2003: total body water (L) = ${m?"1.203 + 0.449(height²/R50) + 0.176(weight)":"3.747 + 0.450(height²/R50) + 0.113(weight)"} = ${o.waterLitres.toFixed(2)} L. Water % ≈ water (L)/weight (kg) × 100 = ${o.waterPercent.toFixed(2)}%, using approximately 1 kg/L for water.`,
    ...(muscle.ok ? [muscle.formula, `Substitution: 0.401×${index.toFixed(4)} + 3.825×${m?1:0} − 0.071×${p.age} + 5.102 = ${muscle.mass.toFixed(2)} kg. Total skeletal muscle index = ${muscle.index.toFixed(2)} kg/m².`, muscle.explanation] : [muscle.reason]),
    "Fat-free mass includes water, organs and bone; it is not skeletal muscle mass. Water is part of fat-free mass, so fat %, water % and fat-free % are not separate percentages to add together.",
    "Limits: Kyle was studied in healthy white adults aged 22–94 with BMI 17.0–33.8; Sun used US cohorts aged 12–94. These population equations have prediction error and have not been validated for this ESP32, random values, interpolated 50 kHz inputs or arbitrary electrode positions. Outputs do not classify health, hydration or obesity. Displayed steps are rounded; calculations use unrounded values."
  ];
}
export function validCompositionRecord(value:unknown):value is CompositionRecord {if(!value||typeof value!=="object")return false;const r=value as CompositionRecord;return r.version===1&&r.randomInputs===true&&typeof r.signature==="string"&&Number.isFinite(Date.parse(r.calculatedAt))&&!!r.profile&&[r.profile.height,r.profile.weight,r.profile.age].every(Number.isFinite)&&["male","female"].includes(r.profile.sex)&&r.profile.layout==="whole-body"&&!!r.input&&["received","interpolated"].includes(r.input.method)&&[r.input.resistance50,r.input.reactance50,r.input.lowerFrequency,r.input.upperFrequency,r.input.lowerR,r.input.upperR,r.input.lowerX,r.input.upperX,r.input.fraction].every(Number.isFinite)&&r.input.resistance50>0&&r.input.reactance50<=0&&!!r.output&&[r.output.fatFreeMass,r.output.fatMass,r.output.fatPercent,r.output.waterLitres,r.output.waterPercent].every(Number.isFinite)&&r.output.fatFreeMass>0&&r.output.fatMass>0&&r.output.fatPercent>0&&r.output.fatPercent<100&&r.output.waterPercent>0&&r.output.waterPercent<100;}


