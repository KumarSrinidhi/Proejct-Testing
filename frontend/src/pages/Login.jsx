import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../services/api";

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { refreshUser } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.login(username, password);
      const token = response?.data?.access_token;
      if (token) {
        localStorage.setItem("access_token", token);
      }
      await refreshUser();
      window.location.href = "/";
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "var(--bg)",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* ── Left Panel ── */}
      <div style={{
        flex: 1,
        display: "none",
        background: "var(--primary)",
        flexDirection: "column",
        padding: "48px",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }} className="login-left-panel">
        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(var(--primary-hover) 1px, transparent 1px), linear-gradient(90deg, var(--primary-hover) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.3,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <CameraIcon />
            </div>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>VisionAttend</span>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <blockquote style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.4rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.02em", maxWidth: 360, marginBottom: 20 }}>
            "Instant, accurate attendance powered by face recognition."
          </blockquote>
          <div style={{ display: "flex", gap: 24 }}>
            {[["99.2%", "Accuracy"], ["0.8s", "Recognition"], ["24/7", "Uptime"]].map(([val, lbl]) => (
              <div key={lbl}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.3rem" }}>{val}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", fontWeight: 500 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel / Form ── */}
      <div style={{
        width: "100%",
        maxWidth: 460,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        margin: "0 auto",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }} className="animate-fade-in">
          {/* Logo */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 38, height: 38,
                background: "var(--primary)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}>
                <CameraIcon />
              </div>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.01em" }}>VisionAttend</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 400 }}>Attendance Management System</div>
              </div>
            </div>
            <div style={{ height: 1, background: "var(--border)", marginTop: 20 }} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: 4 }}>Sign in</h1>
            <p style={{ fontSize: "0.83rem", color: "var(--text-3)" }}>Enter your credentials to access the system</p>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 18, fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
                  <UserIcon />
                </span>
                <input
                  id="login-username"
                  className="input"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingLeft: 34, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-4)", padding: 2, display: "flex",
                  }}
                  tabIndex={-1}
                  title={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading || !username || !password}
              style={{ width: "100%", justifyContent: "center", padding: "9px 16px", fontSize: "0.88rem" }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.7s linear infinite" }}><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-4)", marginTop: 24 }}>
            VisionAttend · Secure Face Recognition Attendance
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 860px) {
          .login-left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
