import { useState } from "react";
import { signup, login } from "../api.js";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next);
    setPending(false);
    setError("");
  }

  async function doLogin(phoneToUse, passwordToUse) {
    setBusy(true);
    setError("");
    try {
      const res = await login({ phone: phoneToUse, password: passwordToUse });
      onAuthenticated({ token: res.token, user: res.user });
    } catch (err) {
      if (err.code === "PENDING_APPROVAL") {
        setPhone(phoneToUse);
        setPassword(passwordToUse);
        setPending(true);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password !== confirm) {
          throw new Error("Passwords do not match");
        }
        await signup({ name, phone, password });
        await doLogin(phone, password);
      } else {
        await doLogin(phone, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <h1>Bug Tracker</h1>
          <p>Report, review, and track bugs with screenshots</p>
        </div>
        <div className="card pending-page">
          <h2>Awaiting approval</h2>
          <p>
            Your account ({phone}) is registered, but an admin still needs to
            approve it before you can use the app. Check back later.
          </p>
          {error && <p className="error">{error}</p>}
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => doLogin(phone, password)}
          >
            {busy ? "Checking..." : "Check approval status"}
          </button>
          <div className="auth-row center">
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode("login")}
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <h1>Bug Tracker</h1>
        <p>Report, review, and track bugs with screenshots</p>
      </div>

      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
        </div>

        <h2>{mode === "login" ? "Welcome back" : "Create an account"}</h2>

        {mode === "signup" && (
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </label>
        )}

        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9999999999"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        {mode === "signup" && (
          <label>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              minLength={6}
              required
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy
            ? "Please wait..."
            : mode === "login"
            ? "Log in"
            : "Sign up"}
        </button>

        <p className="auth-note">
          {mode === "signup"
            ? "Sign up and an admin will approve your account."
            : "New here? Sign up and an admin will approve your account."}
        </p>
      </form>
    </div>
  );
}
