"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setNote("");
    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
      error ? setError(error.message) : setNote("Check your email for a reset link.");
    } else if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      error ? setError(error.message) : router.replace("/dashboard");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin } });
      if (error) setError(error.message);
      else if (data.session) router.replace("/dashboard");
      else setNote("Account created. Confirm your email, then sign in.");
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      <aside className="auth-art">
        <strong style={{ fontFamily: "var(--font-head)", fontSize: "1.3rem" }}>Family Finance</strong>
        <div>
          <h1>Know where every dollar goes.</h1>
          <p>Track bank accounts, cards and salary in CAD, see the value in INR, and plan your savings through 2028.</p>
        </div>
        <small>Private to you. Your data is visible only to you and your household.</small>
      </aside>
      <main className="auth-form">
        <div className="corner"><ThemeToggle /></div>
        <div className="auth-box">
          <h2 style={{ fontSize: "1.8rem" }}>{forgot ? "Reset password" : mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          {!forgot && (
            <div className="tabs" role="tablist">
              <button type="button" className={mode === "signin" ? "on" : ""} onClick={() => setMode("signin")}>Sign in</button>
              <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Sign up</button>
            </div>
          )}
          <form onSubmit={submit} style={{ marginTop: forgot ? "1.25rem" : 0 }}>
            {error && <div className="msg err">{error}</div>}
            {note && <div className="msg ok">{note}</div>}
            {mode === "signup" && !forgot && (
              <label className="field">Your name<input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            )}
            <label className="field">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            {!forgot && (
              <label className="field">Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
            )}
            <button className="btn" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Please wait…" : forgot ? "Send reset link" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: "1rem", fontSize: ".9rem" }}>
            {forgot
              ? <button className="link" onClick={() => setForgot(false)}>Back to sign in</button>
              : mode === "signin" && <button className="link" onClick={() => setForgot(true)}>Forgot password?</button>}
          </p>
        </div>
      </main>
    </div>
  );
}
