import type {CSSProperties} from "react";
/** Deterministic decorative positions keep hydration stable; motion is CSS-only. */
export default function AmbientParticles() {
  return <div className="ambient-particles" aria-hidden="true">{Array.from({length:28},(_,i)=><span
    key={i} className="ambient-particle" style={{
      left:`${(i*37+7)%100}%`,top:`${(i*53+13)%100}%`,
      width:2+i%3,height:2+i%3,
      "--particle-duration":`${22+(i%7)*3}s`,"--particle-delay":`-${i*2.7}s`,
    } as CSSProperties}/>)}</div>;
}
