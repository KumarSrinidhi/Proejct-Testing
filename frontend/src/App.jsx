import { Component } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AttendancePage from "./pages/AttendancePage";
import Dashboard from "./pages/Dashboard";
import HeatmapPage from "./pages/HeatmapPage";
import LiveRecognitionPage from "./pages/LiveRecognitionPage";
import Login from "./pages/Login";
import PersonsPage from "./pages/PersonsPage";
import StudentDashboard from "./pages/StudentDashboard";
import TrainingPage from "./pages/TrainingPage";
import TrendsPage from "./pages/TrendsPage";
import AdminUsersPage from "./pages/AdminUsersPage";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by error boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card bg-red-50 border-red-200 max-w-md w-full">
            <h2 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h2>
            <p className="text-red-800 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ allowedRoles }) {
  const { isAuthed, role } = useAuth();
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function Layout() {
  const { role, logout } = useAuth();

  const links = [];
  links.push({ to: "/", label: role === "student" ? "My Dashboard" : "Dashboard" });
  links.push({ to: "/attendance", label: "Attendance" });

  if (role === "admin") {
    links.push({ to: "/admin/users", label: "Admin Panel" });
    links.push({ to: "/heatmap", label: "Heatmap" });
    links.push({ to: "/trends", label: "Trends" });
    links.push({ to: "/persons", label: "Persons" });
    links.push({ to: "/live", label: "Live" });
    links.push({ to: "/training", label: "Training" });
  }

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
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}

function HomeRoute() {
  const { role } = useAuth();
  return role === "student" ? <StudentDashboard /> : <Dashboard />;
}

export default function App() {
  const { isLoading, isAuthed } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={isAuthed ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<HomeRoute />} />

        <Route element={<ProtectedRoute allowedRoles={["admin", "teacher", "student"]} />}>
          <Route path="attendance" element={<AttendancePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="heatmap" element={<HeatmapPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="persons" element={<PersonsPage />} />
          <Route path="live" element={<LiveRecognitionPage />} />
          <Route path="training" element={<TrainingPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
