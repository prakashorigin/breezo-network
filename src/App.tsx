import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, CircleHelp, Coins, LayoutDashboard, Map, Menu, Radio, Settings, ShieldCheck, UserRoundCog, X } from "lucide-react";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sensors = lazy(() => import("./pages/Sensors"));
const SensorDetails = lazy(() => import("./pages/SensorDetails"));
const MapPage = lazy(() => import("./pages/Map"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { DashboardLayout } from "./layouts/DashboardLayout";
const AnalyticsPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.AnalyticsPage })));
const BlockchainPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.BlockchainPage })));
const RewardsPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.RewardsPage })));
const SettingsPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.UsersPage })));
import { getSession, logout } from "./services/api";

const nav = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { path: "/sensors", label: "Sensors", icon: Radio },
  { path: "/map", label: "Network map", icon: Map },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/rewards", label: "Rewards", icon: Coins },
  { path: "/blockchain", label: "Blockchain", icon: ShieldCheck },
  { path: "/users", label: "Team access", icon: UserRoundCog },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(getSession());

  useEffect(() => {
    if (path === "/") navigate("/dashboard", { replace: true });
    const onNavigate = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target) { navigate(target); setMenuOpen(false); }
    };
    window.addEventListener("breezo:navigate", onNavigate);
    return () => { window.removeEventListener("breezo:navigate", onNavigate); };
  }, [path, navigate]);

  const go = (to: string) => { navigate(to); setMenuOpen(false); };
  const isLogin = path === "/login" || path === "/register";
  if (isLogin) return <Suspense fallback={<div className="screen-loading">Loading account…</div>}><Login mode={path === "/register" ? "register" : "login"} onSuccess={(next) => { setUser(next); go("/dashboard"); }} /></Suspense>;

  const visibleNav = user?.role === "ADMIN" ? nav : nav.filter((item) => item.path !== "/users");
  const current = nav.find((item) => item.path === path) ?? nav[0];
  const content = path === "/dashboard" ? <Dashboard />
    : path === "/sensors" ? <Sensors />
    : path.startsWith("/sensors/") ? <SensorDetails sensorId={decodeURIComponent(path.split("/")[2] ?? "")} />
    : path === "/map" ? <MapPage />
    : path === "/analytics" ? <AnalyticsPage />
    : path === "/rewards" ? <RewardsPage />
    : path === "/blockchain" ? <BlockchainPage />
    : path === "/settings" ? <SettingsPage />
    : path === "/users" ? <UsersPage />
    : <NotFound />;

  return <DashboardLayout
    nav={visibleNav}
    currentPath={path}
    title={current?.label ?? "Breezo Network"}
    user={user}
    menuOpen={menuOpen}
    onNavigate={go}
    onLogout={() => { logout(); setUser(null); go("/login"); }}
  >
    <div className="mobile-top"><button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="brand-mini"><Activity size={17} /> BREEZO</div><button className="icon-button" onClick={() => go("/settings")} aria-label="Settings"><Settings size={18} /></button></div>
    {menuOpen && <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={20} /></button>}
    <Suspense fallback={<div className="screen-loading">Loading workspace…</div>}>{content}</Suspense>
    <div className="help-link"><CircleHelp size={14} /> Network status and documentation</div>
  </DashboardLayout>;
}

export default App;
