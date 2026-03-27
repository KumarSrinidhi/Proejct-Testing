import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import HeatmapPage from "./pages/HeatmapPage";
import TrendsPage from "./pages/TrendsPage";
import PersonsPage from "./pages/PersonsPage";
import AttendancePage from "./pages/AttendancePage";
import LiveRecognitionPage from "./pages/LiveRecognitionPage";
import TrainingPage from "./pages/TrainingPage";
import Login from "./pages/Login";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/heatmap", label: "Heatmap" },
  { to: "/trends", label: "Trends" },
  { to: "/persons", label: "Persons" },
  { to: "/attendance", label: "Attendance" },
  { to: "/live", label: "Live" },
  { to: "/training", label: "Training" },
];

function Layout() {
  return (
    <div className="min-h-screen p-4 md:p-6">
      <header className="card mb-4">
        <h1 className="font-display text-2xl">Face Recognition Attendance</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm ${isActive ? "bg-ink text-white" : "bg-white border border-slate-200"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm"
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export default function App() {
  const isAuthed = Boolean(localStorage.getItem("access_token"));

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={isAuthed ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Dashboard />} />
        <Route path="heatmap" element={<HeatmapPage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="persons" element={<PersonsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="live" element={<LiveRecognitionPage />} />
        <Route path="training" element={<TrainingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
