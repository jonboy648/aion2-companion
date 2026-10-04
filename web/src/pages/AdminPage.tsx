import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { GameButton } from "@/components/game/GameButton";
import { OrnateCard } from "@/components/game/OrnateCard";
import { Input } from "@/components/ui/input";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { ADMIN_TOKEN_KEY, AdminAuthError, fetchAdminStats, type AdminStats } from "@/lib/analytics";

const readToken = (): string => {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};
const writeToken = (t: string) => {
  try {
    if (t) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* blocked storage: the token just lives in memory for this page */
  }
};

/** Owner-only dashboard at #/admin (not linked anywhere). The token lives in sessionStorage only. */
export function AdminPage() {
  const [token, setToken] = useState(readToken);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  const load = useCallback(async (t: string) => {
    setBusy(true);
    setError(null);
    try {
      setStats(await fetchAdminStats(t));
      writeToken(t);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        writeToken("");
        setToken("");
        setStats(null);
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  function signOut() {
    writeToken("");
    setToken("");
    setStats(null);
    setInput("");
  }

  return (
    <>
      <PageHeader title="Site stats" caption="Owner only. Anonymous visit counts and the character names people searched." />
      {error && (
        <p role="alert" className="mb-4 text-sm text-error">
          {error}
        </p>
      )}
      {!token && (
        <OrnateCard className="max-w-md p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = input.trim();
              if (t) setToken(t);
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="admin-token" className="text-sm text-dim">
              Admin token
            </label>
            <Input id="admin-token" type="password" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} />
            <GameButton type="submit" disabled={!input.trim()}>
              Open dashboard
            </GameButton>
            <p className="text-xs text-faint">Kept in this tab&apos;s session storage only; it is gone when you close the tab.</p>
          </form>
        </OrnateCard>
      )}
      {token && !stats && busy && <p className="text-sm text-dim">Loading...</p>}
      {token && !stats && !busy && error && (
        <GameButton size="sm" onClick={() => void load(token)}>
          Retry
        </GameButton>
      )}
      {stats && <AdminDashboard stats={stats} busy={busy} onRefresh={() => void load(token)} onSignOut={signOut} />}
    </>
  );
}
