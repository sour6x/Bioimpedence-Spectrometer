import type { BISSample } from "./bis";

export type ColeParameters = { r0: number; rInfinity: number; fc: number; alpha: number };
export type ColeFit = { ok: false; reason: string } | {
  ok: true; parameters: ColeParameters; rmse: number; relativeErrorPercent: number;
  count: number; minFrequency: number; maxFrequency: number; warnings: string[];
  quality: "close" | "limited"; ri: number; tau: number; capacitanceNF: number | null;
};
export const COLE_METHOD = "Cole v1 · unweighted complex least squares · variable projection with bounded multi-start pattern search";

export function colePoint(p: ColeParameters, frequency: number): BISSample {
  const power = Math.pow(frequency / p.fc, p.alpha);
  const real = 1 + power * Math.cos(p.alpha * Math.PI / 2);
  const imaginary = power * Math.sin(p.alpha * Math.PI / 2);
  const denominator = real * real + imaginary * imaginary;
  const difference = p.r0 - p.rInfinity;
  const resistance = p.rInfinity + difference * real / denominator;
  const reactance = -difference * imaginary / denominator;
  return { frequency, resistance, reactance, impedance: Math.hypot(resistance, reactance), phase: Math.atan2(reactance, resistance) * 180 / Math.PI };
}

export function fitCole(samples: BISSample[]): ColeFit {
  if (samples.length < 6) return { ok: false, reason: "At least six different frequencies are needed before fitting the curve." };
  if (samples.some(s => ![s.frequency, s.resistance, s.reactance].every(Number.isFinite) || s.frequency <= 0 || s.resistance <= 0)) return { ok: false, reason: "The sweep contains invalid frequencies or electrical values." };
  if (new Set(samples.map(s => s.frequency)).size !== samples.length) return { ok: false, reason: "Duplicate frequencies make this sweep ambiguous. Start a fresh sweep." };
  if (samples.some(s => s.reactance > 0)) return { ok: false, reason: "Positive reactance does not match this capacitive Cole model. Check the sign convention and instrument calibration." };
  const sorted = [...samples].sort((a,b) => a.frequency - b.frequency);
  const minFrequency = sorted[0].frequency, maxFrequency = sorted.at(-1)!.frequency;
  const meanZ = sorted.reduce((sum,s) => sum + Math.hypot(s.resistance,s.reactance),0) / sorted.length;
  const span = Math.max(...sorted.map(s=>s.resistance)) - Math.min(...sorted.map(s=>s.resistance));
  if (span < meanZ * .005 || sorted.every(s=>Math.abs(s.reactance) < meanZ * .001)) return { ok: false, reason: "The response is too flat to identify a reliable Cole arc." };
  const low = Math.log(minFrequency / 100), high = Math.log(maxFrequency * 100);
  type Candidate = { logFc: number; alpha: number; rInfinity: number; delta: number; error: number };
  function evaluate(logFc: number, alpha: number): Candidate {
    let uSum=0, uvSum=0, rSum=0, uySum=0;
    const rows = sorted.map(s=>{
      const power=Math.exp(alpha*(Math.log(s.frequency)-logFc));
      const a=1+power*Math.cos(alpha*Math.PI/2), b=power*Math.sin(alpha*Math.PI/2), d=a*a+b*b;
      const u=a/d,v=-b/d;
      uSum+=u;uvSum+=u*u+v*v;rSum+=s.resistance;uySum+=u*s.resistance+v*s.reactance;
      return {u,v,s};
    });
    const n=sorted.length, determinant=n*uvSum-uSum*uSum;
    if (determinant <= 1e-12) return {logFc,alpha,rInfinity:0,delta:0,error:Infinity};
    const rInfinity=(rSum*uvSum-uSum*uySum)/determinant, delta=(n*uySum-uSum*rSum)/determinant;
    if(rInfinity<=0 || delta<=0) return {logFc,alpha,rInfinity,delta,error:Infinity};
    const error=rows.reduce((sum,{u,v,s})=>sum+(rInfinity+delta*u-s.resistance)**2+(delta*v-s.reactance)**2,0);
    return {logFc,alpha,rInfinity,delta,error};
  }
  const starts: Candidate[]=[];
  for(let i=0;i<=24;i++) for(const alpha of [.2,.4,.6,.8,1]) starts.push(evaluate(low+(high-low)*i/24,alpha));
  let best=starts.sort((a,b)=>a.error-b.error)[0];
  for(const start of starts.slice(0,6)) {
    let current=start, stepF=.5, stepA=.1;
    for(let iteration=0;iteration<160 && (stepF>1e-6 || stepA>1e-7);iteration++) {
      let next=current;
      for(const [df,da] of [[-stepF,0],[stepF,0],[0,-stepA],[0,stepA],[-stepF,-stepA],[stepF,stepA],[-stepF,stepA],[stepF,-stepA]]) {
        const f=Math.max(low,Math.min(high,current.logFc+df)), a=Math.max(.1,Math.min(1,current.alpha+da));
        const candidate=evaluate(f,a);if(candidate.error<next.error) next=candidate;
      }
      if(next===current){stepF*=.5;stepA*=.5;}else current=next;
    }
    if(current.error<best.error)best=current;
  }
  if(!Number.isFinite(best.error))return {ok:false,reason:"A physically constrained Cole model could not be fitted to this sweep."};
  const parameters={r0:best.rInfinity+best.delta,rInfinity:best.rInfinity,fc:Math.exp(best.logFc),alpha:best.alpha};
  const rmse=Math.sqrt(best.error/(2*sorted.length)), relativeErrorPercent=100*rmse/meanZ;
  const warnings:string[]=[];
  if(relativeErrorPercent>2)warnings.push("The curve differs noticeably from the received points. Check contact, calibration and whether one Cole arc is an appropriate model.");
  if(parameters.fc<=minFrequency || parameters.fc>=maxFrequency)warnings.push("The fitted peak is outside the measured band; the model parameters are weakly supported.");
  if(maxFrequency/minFrequency<10)warnings.push("The frequency band is narrow, which limits confidence in extrapolated parameters.");
  if(best.alpha<=.101 || best.logFc<=low+.01 || best.logFc>=high-.01)warnings.push("A search boundary was reached. Treat this fit as exploratory.");
  const ri=parameters.r0*parameters.rInfinity/(parameters.r0-parameters.rInfinity),tau=1/(2*Math.PI*parameters.fc);
  return {ok:true,parameters,rmse,relativeErrorPercent,count:sorted.length,minFrequency,maxFrequency,warnings,
    quality:warnings.length?"limited":"close",ri,tau,
    // A unique ideal membrane capacitor is not inferred from a generalized CPE.
    capacitanceNF:parameters.alpha>=.995 && warnings.length===0 ? tau/(parameters.r0+ri)*1e9 : null};
}

export function coleCurve(fit: ColeFit, count=100) {
  if(!fit.ok)return [];
  const low=Math.log(fit.minFrequency),high=Math.log(fit.maxFrequency);
  return Array.from({length:count},(_,i)=>colePoint(fit.parameters,Math.exp(low+(high-low)*i/(count-1))));
}
