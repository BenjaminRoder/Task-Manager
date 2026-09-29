"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRepositories } from "@/lib/supabase/repositories";
import { RepositoryContext } from "@/lib/supabase/repository-context";
import {
  importLocalData,
  pendingLocalImport,
  type LocalImport,
} from "@/lib/storage/local-import";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to connect. Check your connection and retry.";
}

export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabaseConfig())
    return (
      <section className="auth-panel">
        <h1>Connect your private workspace</h1>
        <p>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          to .env.local, apply the database migration, then restart the app. See
          README.md for setup steps.
        </p>
        <p>
          Your existing browser data is preserved. You will be offered an import
          after signing in.
        </p>
      </section>
    );
  return <SessionGate>{children}</SessionGate>;
}

function SessionGate({ children }: { children: ReactNode }) {
  const [client] = useState(browserClient);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signingIn = useRef(false);

  useEffect(() => {
    let active = true;
    let authRevision = 0;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      ++authRevision;
      setUser(session?.user ?? null);
    });
    const initialRevision = authRevision;
    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (initialRevision !== authRevision) {
          setLoading(false);
          return;
        }
        if (error && error.name !== "AuthSessionMissingError")
          setError(error.message);
        setUser(data.user);
        setLoading(false);
      })
      .catch((problem) => {
        if (active) {
          setError(message(problem));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn.current) return;
    const fields = new FormData(event.currentTarget);
    signingIn.current = true;
    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(fields.get("email")),
        password: String(fields.get("password")),
      });
      if (error) throw error;
    } catch (problem) {
      setError(message(problem));
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Checking your session…</p>;
  if (!user)
    return (
      <section className="auth-panel">
        <h1>Sign in</h1>
        <p>Your tasks belong to your private account.</p>
        <form onSubmit={signIn}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={busy}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        <p>
          Use the account created in Supabase. Account setup instructions are in
          README.md.
        </p>
      </section>
    );
  return (
    <>
      <div className="account-bar">
        <span>{user.email}</span>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void signOut()}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!busy && (
        <AccountWorkspace key={user.id} userId={user.id}>
          {children}
        </AccountWorkspace>
      )}
    </>
  );
}

function AccountWorkspace({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [client] = useState(browserClient);
  const repositories = useMemo(
    () => createSupabaseRepositories(client, userId),
    [client, userId],
  );
  const [candidate, setCandidate] = useState<LocalImport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [check, setCheck] = useState(0);
  const importing = useRef(false);
  const project = supabaseConfig()!.url;
  useEffect(() => {
    let active = true;
    pendingLocalImport(client, userId, window.localStorage, project)
      .then((value) => {
        if (active) {
          setCandidate(value);
          setError("");
        }
      })
      .catch((problem) => {
        if (active) setError(`Local import check: ${message(problem)}`);
      });
    return () => {
      active = false;
    };
  }, [client, userId, project, check]);
  async function importData() {
    if (!candidate || importing.current) return;
    importing.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await importLocalData(
        client,
        userId,
        candidate,
        window.localStorage,
        project,
      );
      setCandidate(null);
      setNotice(result);
      setRevision((value) => value + 1);
    } catch (problem) {
      setError(message(problem));
    } finally {
      importing.current = false;
      setBusy(false);
    }
  }
  return (
    <RepositoryContext.Provider value={repositories}>
      {candidate && (
        <section
          className="import-panel"
          aria-label="Import existing local data"
        >
          <h2>Existing local data found</h2>
          <p>
            {candidate.data.tasks.length} tasks and{" "}
            {candidate.data.categories.length} categories can be imported to
            this account, including completed and deleted records. Only import
            if this browser data belongs to you. The original data will be kept.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void importData()}
          >
            {busy ? "Importing…" : "Import local data"}
          </button>
          <p>
            You can keep using your account without importing. This offer
            remains available.
          </p>
        </section>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => setCheck((value) => value + 1)}
          >
            Check again
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div key={revision} inert={busy}>
        {children}
      </div>
    </RepositoryContext.Provider>
  );
}
