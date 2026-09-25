import { useEffect, useState, type ReactNode } from "react";
import { Sidebar, type NavItem } from "../components/Sidebar";
import { Navbar } from "../components/Navbar";
import type { SessionUser } from "../services/api";
import { request } from "../services/api";
interface Props { children: ReactNode; nav: NavItem[]; currentPath: string; title: string; user: SessionUser | null; menuOpen: boolean; onNavigate: (to: string) => void; onLogout: () => void }
export function DashboardLayout({ children, nav, currentPath, title, user, menuOpen, onNavigate, onLogout }: Props) {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [databaseStatus, setDatabaseStatus] = useState("unknown");
  useEffect(() => {
    let active = true;
    const ping = async () => { try { const result = await request<{ services?: { database?: string } }>("/health"); if (active) { setApiStatus("online"); setDatabaseStatus(result.services?.database ?? "unknown"); } } catch { if (active) { setApiStatus("offline"); setDatabaseStatus("unavailable"); } } };
    void ping(); const timer = window.setInterval(() => void ping(), 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <div className="app-shell"><div className={`sidebar-wrap ${menuOpen ? "opened" : ""}`}><Sidebar items={nav} currentPath={currentPath} user={user} apiStatus={apiStatus} databaseStatus={databaseStatus} onNavigate={onNavigate} onLogout={onLogout} /></div><main className="main-column"><Navbar title={title} user={user} onNavigate={onNavigate} /><div className="page-container">{children}</div></main></div>;
}
