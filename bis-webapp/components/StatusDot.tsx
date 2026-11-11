export default function StatusDot({connected,measuring}:{connected:boolean;measuring:boolean}) {
  return <span aria-hidden="true" className={`status-dot ${connected?`online-dot${measuring?" measuring-dot":""}`:"offline-dot"}`}/>;
}
