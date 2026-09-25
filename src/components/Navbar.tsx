import { ChevronDown, Search } from "lucide-react";
import type { SessionUser } from "../services/api";
export function Navbar({ title, user, onNavigate }: { title: string; user: SessionUser | null; onNavigate: (to: string) => void }) {
  return <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{title}</strong></div><div className="top-actions"><button className="top-search" onClick={() => onNavigate("/sensors")}><Search size={15} /><span>Find a sensor</span></button><button className="top-profile" onClick={() => onNavigate("/settings")}><span className="avatar small">{(user?.name ?? "G").slice(0, 1).toUpperCase()}</span><ChevronDown size={14} /></button></div></header>;
}
