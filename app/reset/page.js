"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
export default function Reset() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    error ? setError(error.message) : router.replace("/dashboard");
  }
  return (
    <div className="auth-form" style={{ minHeight: "100vh" }}>
      <form className="auth-box" onSubmit={submit}>
        <h2 style={{ marginBottom: "1rem" }}>Choose a new password</h2>
        {error && <div className="msg err">{error}</div>}
        <label className="field">New password<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" style={{ width: "100%" }}>Save password</button>
      </form>
    </div>
  );
}
