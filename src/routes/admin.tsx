import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import {
  adminLogin,
  adminLogout,
  adminStatus,
  changeAdminPassword,
  deleteScreenshot,
  getAdminSettings,
  listScreenshots,
  saveAdminSettings,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin Panel | Payment & Site Settings" },
      {
        name: "description",
        content:
          "Password protected admin panel to manage payment number, account name, price and payment screenshots.",
      },
      { property: "og:title", content: "Admin Panel | Payment & Site Settings" },
      {
        property: "og:description",
        content: "Manage payment details, price and customer payment proofs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Settings = {
  phone_number: string;
  account_name: string;
  account_label: string;
  amount: number;
  whatsapp_link: string;
  logo_url: string | null;
};

type Shot = {
  id: string;
  user_phone: string | null;
  amount: number | null;
  created_at: string;
  url: string | null;
};

const input =
  "w-full h-11 px-3 rounded-lg bg-[#0f131a] border border-white/15 text-white outline-none focus:border-rose-500";
const label = "block mt-3 mb-1.5 text-sm text-slate-300";
const btn =
  "h-11 px-5 rounded-lg font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60";
const btnAlt = "h-11 px-5 rounded-lg font-bold text-white bg-slate-700 hover:bg-slate-600";
const btnDanger = "h-11 px-5 rounded-lg font-bold text-white bg-red-800 hover:bg-red-900";
const panel = "rounded-2xl border border-white/15 bg-[#171c24] p-6 shadow-2xl";

function resizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 400;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = dataUrl;
  });
}

function AdminPage() {
  const status = useServerFn(adminStatus);
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const loadSettings = useServerFn(getAdminSettings);
  const saveSettings = useServerFn(saveAdminSettings);
  const loadShots = useServerFn(listScreenshots);
  const removeShot = useServerFn(deleteScreenshot);
  const changePassword = useServerFn(changeAdminPassword);

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [shots, setShots] = useState<Shot[]>([]);
  const [shotsMsg, setShotsMsg] = useState("");

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const refreshAll = useCallback(async () => {
    try {
      const s = (await loadSettings()) as Settings | null;
      if (s) setSettings({ ...s, amount: Number(s.amount) });
      const list = (await loadShots()) as Shot[];
      setShots(list);
      setShotsMsg(`${list.length} screenshot(s)`);
    } catch {
      setAuthed(false);
    }
  }, [loadSettings, loadShots]);

  useEffect(() => {
    (async () => {
      const s = await status();
      setAuthed(s.authenticated);
      setReady(true);
      if (s.authenticated) await refreshAll();
    })();
  }, [status, refreshAll]);

  const handleLogin = async () => {
    setLoginError("");
    const res = await login({ data: { password } });
    if (!res.ok) return setLoginError("Wrong password");
    setPassword("");
    setAuthed(true);
    await refreshAll();
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg("Saving...");
    const res = await saveSettings({
      data: {
        phone_number: settings.phone_number,
        account_name: settings.account_name,
        account_label: settings.account_label,
        amount: Number(settings.amount) || 0,
        whatsapp_link: settings.whatsapp_link ?? "",
        logo_url: settings.logo_url,
      },
    });
    setSaving(false);
    setMsg(res.ok ? "Saved — website updated." : res.error || "Could not save");
  };

  const handleLogo = async (file: File) => {
    const raw = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
    const small = await resizeImage(raw);
    setSettings((prev) => (prev ? { ...prev, logo_url: small } : prev));
    setMsg("New logo selected — press Save to apply.");
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    const res = await changePassword({
      data: { currentPassword: curPw, newPassword: newPw },
    });
    if (!res.ok) return setPwMsg(res.error || "Could not change password");
    setCurPw("");
    setNewPw("");
    setPwMsg("Password changed successfully.");
  };

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#101318] text-white grid place-items-center">
        <p>Loading…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#101318] text-white grid place-items-center p-4">
        <div className={`${panel} w-full max-w-sm`}>
          <h1 className="text-xl font-bold">Admin Login</h1>
          <label className={label} htmlFor="pw">
            Password
          </label>
          <input
            id="pw"
            type="password"
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {loginError && <p className="mt-3 text-sm text-red-400">{loginError}</p>}
          <button type="button" className={`${btn} mt-4 w-full`} onClick={handleLogin}>
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101318] text-white p-4 md:p-8">
      <div className="mx-auto grid max-w-4xl gap-6">
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <button
              type="button"
              className={btnAlt}
              onClick={async () => {
                await logout();
                setAuthed(false);
              }}
            >
              Logout
            </button>
          </div>

          {settings && (
            <>
              <label className={label}>Payment Number</label>
              <input
                className={input}
                value={settings.phone_number}
                onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
              />

              <label className={label}>Account Name</label>
              <input
                className={input}
                value={settings.account_name}
                onChange={(e) => setSettings({ ...settings, account_name: e.target.value })}
              />

              <label className={label}>Account Label (JazzCash / EasyPaisa)</label>
              <input
                className={input}
                value={settings.account_label}
                onChange={(e) => setSettings({ ...settings, account_label: e.target.value })}
              />

              <label className={label}>Price (PKR)</label>
              <input
                type="number"
                min={0}
                className={input}
                value={settings.amount}
                onChange={(e) => setSettings({ ...settings, amount: Number(e.target.value) })}
              />

              <label className={label}>WhatsApp Support Link</label>
              <input
                className={input}
                value={settings.whatsapp_link ?? ""}
                onChange={(e) => setSettings({ ...settings, whatsapp_link: e.target.value })}
              />

              <label className={label}>Website Logo</label>
              <input
                type="file"
                accept="image/*"
                className="text-sm text-slate-300"
                onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])}
              />
              {settings.logo_url && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={settings.logo_url}
                    alt="Current website logo"
                    className="max-h-16 rounded bg-white p-2"
                  />
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => setSettings({ ...settings, logo_url: null })}
                  >
                    Remove Logo
                  </button>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className={btn} disabled={saving} onClick={handleSave}>
                  Save Changes
                </button>
                <button type="button" className={btnAlt} onClick={refreshAll}>
                  Reload
                </button>
              </div>
              {msg && <p className="mt-3 text-sm text-sky-300">{msg}</p>}
            </>
          )}
        </section>

        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Payment Screenshots</h2>
            <div className="flex gap-3">
              <button type="button" className={btnAlt} onClick={refreshAll}>
                Refresh
              </button>
              <button
                type="button"
                className={btnDanger}
                onClick={async () => {
                  if (!confirm("Delete ALL screenshots?")) return;
                  await removeShot({ data: { all: true } });
                  await refreshAll();
                }}
              >
                Delete All
              </button>
            </div>
          </div>
          {shotsMsg && <p className="mt-2 text-sm text-slate-400">{shotsMsg}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {shots.map((s) => (
              <div
                key={s.id}
                className="overflow-hidden rounded-lg border border-white/10 bg-[#0f131a]"
              >
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <img
                      src={s.url}
                      alt={`Payment proof from ${s.user_phone ?? "unknown customer"}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="grid aspect-[3/4] place-items-center text-xs text-slate-500">
                    No preview
                  </div>
                )}
                <div className="p-2 text-xs text-slate-300">
                  <div className="font-bold text-white">{s.user_phone || "Unknown"}</div>
                  <div>PKR {s.amount ?? "-"}</div>
                  <div>{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  className="h-9 w-full bg-red-800 text-xs font-bold text-white hover:bg-red-900"
                  onClick={async () => {
                    await removeShot({ data: { id: s.id } });
                    await refreshAll();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {shots.length === 0 && (
              <p className="text-sm text-slate-400">No screenshots uploaded yet.</p>
            )}
          </div>
        </section>

        <section className={panel}>
          <h2 className="text-xl font-bold">Change Admin Password</h2>
          <label className={label}>Current Password</label>
          <input
            type="password"
            className={input}
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
          />
          <label className={label}>New Password</label>
          <input
            type="password"
            className={input}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <button type="button" className={`${btn} mt-4`} onClick={handleChangePassword}>
            Update Password
          </button>
          {pwMsg && <p className="mt-3 text-sm text-sky-300">{pwMsg}</p>}
        </section>
      </div>
    </main>
  );
}
