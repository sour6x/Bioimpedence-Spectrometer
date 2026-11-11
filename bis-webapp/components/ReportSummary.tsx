import type {SweepReport} from "@/lib/reports";
import type {ColeFit} from "@/lib/cole";
import {reportStory} from "@/lib/report-story";

export default function ReportSummary({report,fit,running}:{report:SweepReport;fit:ColeFit;running:boolean}) {
  const story=reportStory(report,fit);
  return <article className="dp-card rp-section report-overview">
    <div className="small-label">{running?"PROVISIONAL REPORT":report.simulated?"DEMONSTRATION REPORT":"RESULT SUMMARY"}</div>
    <h2>What this sweep tells us</h2>
    <p className="report-lead">{story.conclusion}</p>
    <div className="report-highlights"><div><span>Across the frequency band</span><strong>{story.percent===null?"Not enough readings":`${Math.abs(story.percent).toFixed(1)}% ${story.percent<0?"lower":story.percent>0?"higher":"change"}`}</strong><small>Change in impedance, not change over time</small></div><div><span>How closely the model follows the points</span><strong>{fit.ok?fit.quality==="close"?"Close agreement":"Limited fit":"Not fitted yet"}</strong><small>Numerical agreement, not a health rating</small></div></div>
    {running&&<p className="dp-note">Readings are still arriving. The result and fitted curve may change until the sweep finishes.</p>}
  </article>;
}
