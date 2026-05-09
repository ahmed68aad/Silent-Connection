import { useState } from "react";
import AuthForm from "../components/AuthForm";
import AuthHero from "../components/AuthHero";
import Toast from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import { useTheme } from "../state/ThemeContext";
import { LogIn, UserPlus } from "lucide-react";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ tone: "info", message: "" });

  const handleSubmit = async (payload) => {
    setBusy(true);
    setFeedback({ tone: "info", message: "" });

    try {
      if (mode === "login") {
        await signIn(payload);
      } else {
        await signUp(payload);
      }
    } catch (error) {
      setFeedback({ tone: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <nav className="app-navbar auth-navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">
            <img src="/app-logo.png" alt="" />
          </span>
          <strong>Silent Connection</strong>
        </div>

        <div className="navbar-links">
          <button
            type="button"
            className={`navbar-link auth-nav-link ${mode === "login" ? "active" : ""}`}
            aria-label="Sign in"
            title="Sign in"
            onClick={() => setMode("login")}
          >
            <LogIn size={18} strokeWidth={2.3} />
            <span>Login</span>
          </button>
          <button
            type="button"
            className={`navbar-link auth-nav-link ${mode === "register" ? "active" : ""}`}
            aria-label="Create account"
            title="Create account"
            onClick={() => setMode("register")}
          >
            <UserPlus size={18} strokeWidth={2.3} />
            <span>Join</span>
          </button>

          <button
            type="button"
            className={`theme-switch-button ${isDark ? "is-on" : ""}`}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
            title={isDark ? "Dark mode on" : "Dark mode off"}
            onClick={toggleTheme}
          >
            <span className="theme-switch-track">
              <span className="theme-switch-knob" />
            </span>
          </button>
        </div>
      </nav>

      <div className="auth-layout">
        <AuthHero />

        <div className="auth-column">
          <Toast tone={feedback.tone} message={feedback.message} />
          <AuthForm key={mode} mode={mode} onSubmit={handleSubmit} busy={busy} />
        </div>
      </div>
    </div>
  );
}
