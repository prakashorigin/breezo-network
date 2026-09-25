import { Radio } from "lucide-react";
export function LiveIndicator({ connected, demo = false }: { connected: boolean; demo?: boolean }) { return <span className={`live-pill ${demo ? "demo" : connected ? "live" : "offline"}`}><i />{demo ? "DEMO DATA" : connected ? "LIVE" : "CONNECTING"}<Radio size={12} /></span>; }
