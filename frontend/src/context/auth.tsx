import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, loadToken, setToken } from "@/src/api/client";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  auth_provider: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, name: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const handledSessionIds = useRef<Set<string>>(new Set());

  const applySession = useCallback(async (sessionId: string) => {
    if (!sessionId || handledSessionIds.current.has(sessionId)) return;
    handledSessionIds.current.add(sessionId);
    const data = await api("/auth/session", {
      method: "POST",
      body: { session_id: sessionId },
    });
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      // Web: process a session_id in the URL first.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid =
          extractSessionId(window.location.hash) ||
          extractSessionId(window.location.search);
        if (sid) {
          await applySession(sid);
          try {
            const clean = window.location.pathname;
            window.history.replaceState(window.history.state, "", clean);
          } catch {}
          return;
        }
      } else {
        // Mobile cold start deep link.
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) {
          await applySession(sid);
          return;
        }
      }

      const token = await loadToken();
      if (token) {
        const me = await api("/auth/me");
        setUser(me.user);
      }
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    bootstrap();
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) applySession(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [bootstrap, applySession]);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const data = await api("/auth/register", {
        method: "POST",
        body: { email, password, name },
      });
      await setToken(data.session_token);
      setUser(data.user);
      return data.user as User;
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await setToken(data.session_token);
    setUser(data.user);
    return data.user as User;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web"
        ? `${window.location.origin}/`
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
      redirectUrl,
    )}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (!captured) captured = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let url: string | null = null;
      if (result.type === "success" && (result as any).url) {
        url = (result as any).url;
      }
      if (!url) url = captured;
      if (!url) url = await Linking.getInitialURL();
      const sid = extractSessionId(url);
      if (sid) await applySession(sid);
    } finally {
      sub.remove();
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api("/auth/me");
      setUser(me.user);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, loginWithGoogle, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
