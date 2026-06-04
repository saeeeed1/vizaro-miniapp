"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { SessionPayload } from "@/lib/types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, unknown>;
        colorScheme?: "light" | "dark";
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

interface MiniAppContextValue {
  session: SessionPayload | null;
  loading: boolean;
  error: string | null;
  isTelegram: boolean;
  request: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  requestRaw: (path: string, init?: ApiRequestInit) => Promise<Response>;
  refreshSession: () => Promise<void>;
  switchDemoUser: (userId: string) => Promise<void>;
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null);
const DEMO_STORAGE_KEY = "attendance-mini-app.demo-user-id";

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonLike | Record<string, unknown> | null;
};

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const telegramInitData = window.Telegram?.WebApp?.initData;
  const demoUserId = window.localStorage.getItem(DEMO_STORAGE_KEY);

  if (telegramInitData) {
    headers["x-telegram-init-data"] = telegramInitData;
  } else if (demoUserId) {
    headers["x-demo-user-id"] = demoUserId;
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/session", {
        headers: buildAuthHeaders(),
        cache: "no-store"
      });
      const payload = await parseResponse<SessionPayload>(response);
      setSession(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Session load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      setIsTelegram(true);
      webApp.ready?.();
      webApp.expand?.();
    }

    if (!window.localStorage.getItem(DEMO_STORAGE_KEY)) {
      window.localStorage.setItem(DEMO_STORAGE_KEY, "user_admin_1");
    }

    void refreshSession();
  }, [refreshSession]);

  const requestRaw = useCallback(async (path: string, init?: ApiRequestInit) => {
    const headers = new Headers(init?.headers ?? {});

    for (const [key, value] of Object.entries(buildAuthHeaders())) {
      headers.set(key, value);
    }

    const rawBody = init?.body;
    let payload: BodyInit | null | undefined;

    if (
      rawBody == null ||
      typeof rawBody === "string" ||
      rawBody instanceof FormData ||
      rawBody instanceof URLSearchParams ||
      rawBody instanceof Blob ||
      rawBody instanceof ArrayBuffer ||
      ArrayBuffer.isView(rawBody)
    ) {
      payload = rawBody;
    } else {
      payload = JSON.stringify(rawBody);
    }

    if (payload && !headers.has("Content-Type") && !(payload instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(path, {
      ...init,
      headers,
      body: payload,
      cache: "no-store"
    });
  }, []);

  const request = useCallback(
    async <T,>(path: string, init?: ApiRequestInit): Promise<T> => {
      const response = await requestRaw(path, init);
      return parseResponse<T>(response);
    },
    [requestRaw]
  );

  const switchDemoUser = useCallback(
    async (userId: string) => {
      window.localStorage.setItem(DEMO_STORAGE_KEY, userId);
      await refreshSession();
    },
    [refreshSession]
  );

  const value = useMemo<MiniAppContextValue>(
    () => ({
      session,
      loading,
      error,
      isTelegram,
      request,
      requestRaw,
      refreshSession,
      switchDemoUser
    }),
    [session, loading, error, isTelegram, request, requestRaw, refreshSession, switchDemoUser]
  );

  return <MiniAppContext.Provider value={value}>{children}</MiniAppContext.Provider>;
}

export function useMiniApp() {
  const context = useContext(MiniAppContext);

  if (!context) {
    throw new Error("useMiniApp must be used within MiniAppProvider.");
  }

  return context;
}
