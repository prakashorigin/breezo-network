import type { ComponentType } from "react";
import { Activity, LogOut, Settings } from "lucide-react";
import type { SessionUser } from "../services/api";

export interface NavItem { path: string; label: string; icon: ComponentType<{ size?: number }> }
interface Props { items: NavItem[]; currentPath: string; user: SessionUser | null; apiStatus: "checking" | "online" | "offline"; databaseStatus: string; onNavigate: (to: string) => void; onLogout: () => void }

export function Sidebar({ items, currentPath, user, apiStatus, databaseStatus, onNavigate, onLogout }: Props) {
  return <aside className="sidebar">
    <div className="side-brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.4} /></div><div><strong>BREEZO</strong><span>NETWORK</span></div></div>
    <div className="workspace-label">WORKSPACE</div>
    <nav className="side-nav">{items.map(({ path, label, icon: Icon }) => <button key={path} className={`nav-item ${currentPath === path || (path === "/sensors" && currentPath.startsWith("/sensors/")) ? "active" : ""}`} onClick={() => onNavigate(path)}><Icon size={17} /><span>{label}</span>{path === "/sensors" && <small className="nav-count">04</small>}</button>)}</nav>
    <div className="side-spacer" />
    <div className="network-card"><span className="network-card-icon"><Activity size={14} /></span><div><strong>{apiStatus === "online" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API"}</strong><span>MongoDB {databaseStatus}</span></div><span className={apiStatus === "online" ? "pulse-dot" : "status-dot-muted"} /></div>
    <button className="nav-item side-secondary" onClick={() => onNavigate("/settings")}><Settings size={17} /><span>Settings</span></button>
    <div className="side-user"><div className="avatar">{(user?.name ?? "Guest").slice(0, 1).toUpperCase()}</div><div className="user-detail"><strong>{user?.name ?? "Network guest"}</strong><span>{user?.role?.replace("_", " ") ?? "VIEW ONLY"}</span></div><button className="logout-button" onClick={user ? onLogout : () => onNavigate("/login")} title={user ? "Sign out" : "Sign in"}><LogOut size={16} /></button></div>
  </aside>;
}
