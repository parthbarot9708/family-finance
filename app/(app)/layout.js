"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setCfg, profileToCfg } from "@/lib/settings";
import ThemeToggle from "@/components/ThemeToggle";
import "@/components/tx.css";

const ICON = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  money: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4",
  plan: "M4 20V10M10 20V4M16 20v-8M2 20h20",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  more: "M4 6h16M4 12h16M4 18h16",
};
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// Five sections. Pages inside a section are shown as tabs at the top.
const GROUPS = [
  { label: "Home", icon: "home", href: "/dashboard", tabs: [] },
  { label: "Money", icon: "money", href: "/bank", tabs: [["/bank", "Bank"], ["/cards", "Cards"], ["/salary", "Salary"]] },
  { label: "Plan", icon: "plan", href: "/limits", tabs: [["/limits", "Monthly limits"], ["/budget", "Annual budget"], ["/projection", "Projection & goals"]] },
  { label: "Household", icon: "people", href: "/household", tabs: [] },
  { label: "More", icon: "more", href: "/accounts", tabs: [["/accounts", "Accounts"], ["/export", "Import & export"], ["/settings", "Settings"]] },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not set up yet
  const [later, setLater] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => (data.session ? setUser(data.session.user) : router.replace("/login")));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => (s ? setUser(s.user) : router.replace("/login")));
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => {
      if (data) { setCfg(profileToCfg(data)); setProfile(data); } else setProfile(null);
    });
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  useEffect(() => { if (profile === null && path !== "/settings") router.replace("/settings"); }, [profile, path, router]);

  if (!user || profile === undefined || (profile === null && path !== "/settings")) return null;

  const groups = GROUPS.map((g) => (g.label === "More" && isAdmin ? { ...g, tabs: [...g.tabs, ["/admin", "Admin"]] } : g));
  const current = groups.find((g) => g.tabs.some(([h]) => h === path) || g.href === path);
  const days = profile?.last_backup ? Math.floor((Date.now() - new Date(profile.last_backup)) / 864e5) : null;
  const age = profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at)) / 864e5) : 0;
  const due = profile && !later && ((days === null && age >= 7) || (days !== null && days >= 30));
  const signOut = () => supabase.auth.signOut();

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Family Finance</span>
        <ThemeToggle />
        <button className="btn ghost sm" onClick={signOut}>Sign out</button>
      </header>

      <nav className="side" aria-label="Main">
        <div className="brand">Family Finance</div>
        {groups.map((g) => (
          <Link key={g.label} href={g.href} className={`nav ${current === g ? "on" : ""}`}><Icon d={ICON[g.icon]} />{g.label}</Link>
        ))}
        <div className="foot">
          <span>{user.user_metadata?.name || user.email}</span>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <ThemeToggle />
            <button className="btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </nav>

      <main className="main">
        {due && (
          <div className="banner">
            <span>Time for your monthly backup. {days === null ? "You have not downloaded one yet." : `Your last backup was ${days} days ago.`}</span>
            <Link className="btn sm" href="/export">Download backup</Link>
            <button className="btn ghost sm" onClick={() => setLater(true)}>Later</button>
          </div>
        )}
        {current?.tabs.length > 0 && (
          <nav className="subtabs" aria-label="Section pages">
            {current.tabs.map(([href, label]) => <Link key={href} href={href} className={path === href ? "on" : ""}>{label}</Link>)}
          </nav>
        )}
        {children}
      </main>

      <nav className="bottombar" aria-label="Main">
        {groups.map((g) => (
          <Link key={g.label} href={g.href} className={current === g ? "on" : ""}><Icon d={ICON[g.icon]} />{g.label}</Link>
        ))}
      </nav>
    </div>
  );
}
