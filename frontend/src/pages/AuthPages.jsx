import { useState } from "react";

import { API_BASE_URL } from "../lib/appConfig";
import { formatRequestError } from "../lib/appHelpers";

export function SignInPage({ onSuccess, onGoToSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Sign in failed.");
      }
      onSuccess({
        userId: payload.userId,
        email: payload.email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    } catch (err) {
      setError(
        formatRequestError(err, "Could not sign in. Check your credentials."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto" }}>
      <h2 className="section-title">Welcome back</h2>
      <p className="sync-line">Sign in to access your recipes and pantry.</p>

      <section className="card gradient-card">
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          autoComplete="email"
        />

        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          autoComplete="current-password"
        />

        {error ? <p className="error-text">{error}</p> : null}

        <button
          type="button"
          className="save-btn"
          style={{ marginTop: "1rem" }}
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </section>

      <p
        className="sync-line"
        style={{ textAlign: "center", marginTop: "1rem" }}
      >
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onGoToSignUp}
          style={{
            background: "none",
            border: "none",
            color: "var(--brand-dark)",
            cursor: "pointer",
            fontWeight: 700,
            padding: 0,
            width: "auto",
            margin: 0,
            fontSize: "inherit",
            textDecoration: "underline",
          }}
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

export function SignUpPage({ onSuccess, onGoToSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Sign up failed.");
      }
      onSuccess({
        userId: payload.userId,
        email: payload.email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    } catch (err) {
      setError(formatRequestError(err, "Could not create account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto" }}>
      <h2 className="section-title">Create your account</h2>
      <p className="sync-line">
        Join Just Cook It to save recipes and manage your pantry.
      </p>

      <section className="card gradient-card">
        <label htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label htmlFor="signup-confirm">Confirm password</label>
        <input
          id="signup-confirm"
          type="password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
          autoComplete="new-password"
        />

        {error ? <p className="error-text">{error}</p> : null}

        <button
          type="button"
          className="save-btn"
          style={{ marginTop: "1rem" }}
          onClick={handleSignUp}
          disabled={loading}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </section>

      <p
        className="sync-line"
        style={{ textAlign: "center", marginTop: "1rem" }}
      >
        Already have an account?{" "}
        <button
          type="button"
          onClick={onGoToSignIn}
          style={{
            background: "none",
            border: "none",
            color: "var(--brand-dark)",
            cursor: "pointer",
            fontWeight: 700,
            padding: 0,
            width: "auto",
            margin: 0,
            fontSize: "inherit",
            textDecoration: "underline",
          }}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
