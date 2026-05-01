import { Component, createContext, useContext, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useOffline } from "./hooks/useOffline";
import AttendancePage from "./pages/AttendancePage";
import UndetectedFacesPage from "./pages/UndetectedFacesPage";
import Dashboard from "./pages/Dashboard";
import HeatmapPage from "./pages/HeatmapPage";
import LiveRecognitionPage from "./pages/LiveRecognitionPage";
import Login from "./pages/Login";
import PersonsPage from "./pages/PersonsPage";
import StudentDashboard from "./pages/StudentDashboard";
import TrainingPage from "./pages/TrainingPage";
import TrendsPage from "./pages/TrendsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AuditLogsPage from "./pages/AuditLogsPage";

// ─── Theme Context ────────────────────────────────────────────────────────────
export const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("va-theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("va-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const HomeIcon     = () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
const ClockIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const UsersIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const VideoIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const MapIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const TrendIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const PersonIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const BrainIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>;
const AlertIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const ScrollIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const LogoutIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const MenuIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const EyeIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const BellIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const SunIcon      = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, minHeight: 300 }}>
        <div className="card" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--danger-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "var(--danger)" }}>
            <AlertIcon />
          </div>
          <p className="page-title" style={{ marginBottom: 6 }}>Something went wrong</p>
          <p style={{ color: "var(--text-3)", fontSize: "0.83rem", marginBottom: 16 }}>An unexpected error occurred.</p>
          <button onClick={() => window.location.reload()} className="btn btn-danger">Refresh Page</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ allowedRoles }) {
  const { isAuthed, role } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function Layout() {
  const { role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOffline } = useOffline();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const links = [
    { to: "/", label: role === "student" ? "My Dashboard" : "Dashboard", icon: <HomeIcon />, end: true },
    { to: "/attendance", label: "Attendance", icon: <ClockIcon /> },
    ...(role === "admin" || role === "teacher" ? [
      { to: "/undetected-faces", label: "Undetected", icon: <AlertIcon /> },
    ] : []),
    ...(role === "admin" ? [
      { to: "/live", label: "Live Recognition", icon: <VideoIcon /> },
      { to: "/persons", label: "Persons", icon: <PersonIcon /> },
      { to: "/training", label: "Training", icon: <BrainIcon /> },
      { to: "/trends", label: "Trends", icon: <TrendIcon /> },
      { to: "/heatmap", label: "Heatmap", icon: <MapIcon /> },
      { to: "/admin/users", label: "Users", icon: <UsersIcon /> },
      { to: "/audit-logs", label: "Audit Logs", icon: <ScrollIcon /> },
    ] : []),
  ];

  const initials = role ? role.slice(0, 2).toUpperCase() : "VA";

  const roleBadgeColors = {
    admin:   { bg: "var(--primary-bg)",  color: "var(--primary)" },
    teacher: { bg: "var(--info-bg)",      color: "var(--info)" },
    student: { bg: "var(--success-bg)",   color: "var(--success)" },
  };
  const rb = roleBadgeColors[role] || { bg: "var(--surface-2)", color: "var(--text-3)" };

  return (
    <div className="app-shell">
      {/* ── Offline Banner ── */}
      {isOffline && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "#f59e0b", color: "#1c1917", padding: "6px 16px",
          fontSize: "0.8rem", fontWeight: 600, textAlign: "center",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{ fontSize: "1em" }}>⚠️</span>
          You are offline — showing cached data. Some features may be unavailable.
        </div>
      )}
      {/* ── Sidebar ── */}
      <aside className="sidebar" style={{ width: sidebarOpen ? "var(--sidebar-width)" : 0, minWidth: sidebarOpen ? "var(--sidebar-width)" : 0, overflow: "hidden", transition: "width 0.2s ease, min-width 0.2s ease", marginTop: isOffline ? 32 : 0 }}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <EyeIcon />
          </div>
          <div>
            <div className="sidebar-logo-text">VisionAttend</div>
            <div className="sidebar-logo-sub">Attendance System</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              {link.icon}
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ textTransform: "capitalize" }}>{role}</div>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, background: rb.bg, color: rb.color, padding: "1px 7px", borderRadius: 9999, display: "inline-block", marginTop: 2 }}>
              {role}
            </span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await logout(); window.location.href = "/login"; }}
            title="Sign out"
            style={{ padding: "6px 8px", flexShrink: 0 }}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-wrapper">
        {/* Topbar */}
        <header className="topbar">
          <button className="theme-toggle" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar">
            <MenuIcon />
          </button>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-3)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
              System Online
            </div>

            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            <button className="theme-toggle" title="Notifications">
              <BellIcon />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="page-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// ─── Home Route ───────────────────────────────────────────────────────────────
function HomeRoute() {
  const { role } = useAuth();
  return role === "student" ? <StudentDashboard /> : <Dashboard />;
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <EyeIcon />
      </div>
      <div className="spinner" />
      <p style={{ fontSize: "0.83rem", color: "var(--text-3)" }}>Loading VisionAttend…</p>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { isLoading, isAuthed } = useAuth();
  if (isLoading) return <LoadingScreen />;

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />

        <Route path="/" element={isAuthed ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<HomeRoute />} />

          <Route element={<ProtectedRoute allowedRoles={["admin", "teacher", "student"]} />}>
            <Route path="attendance" element={<AttendancePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin", "teacher"]} />}>
            <Route path="undetected-faces" element={<UndetectedFacesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="heatmap" element={<HeatmapPage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="persons" element={<PersonsPage />} />
            <Route path="live" element={<LiveRecognitionPage />} />
            <Route path="training" element={<TrainingPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
