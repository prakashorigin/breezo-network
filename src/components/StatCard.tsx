import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
export function StatCard({ label, value, unit, icon, trend, tone = "mint", note }: { label: string; value: string | number; unit?: string; icon: ReactNode; trend?: string; tone?: string; note?: string }) {
  return <article className="stat-card"><div className="stat-head"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-foot">{trend && <span className={`trend ${trend.startsWith("+") ? "up" : "down"}`}>{trend.startsWith("+") ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{trend}</span>}<span>{note}</span></div><div className={`stat-spark ${tone}`} /></article>;
}
