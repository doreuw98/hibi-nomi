// Thin fetch wrapper around the HIBI NOMI backend. Holds the session token in
// memory + secure storage so every request carries the Bearer header.
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = "hibi_session_token";

let memToken: string | null = null;

export async function setToken(token: string | null) {
  memToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  memToken = await storage.secureGet(TOKEN_KEY, null);
  return memToken;
}

export function getToken(): string | null {
  return memToken;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Options = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  raw?: boolean;
};

export async function api(path: string, opts: Options = {}): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (memToken) headers["Authorization"] = `Bearer ${memToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (opts.raw) {
    if (!res.ok) throw new ApiError("Request failed", res.status, null);
    return res.text();
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" ? data : "Something went wrong");
    const msg = Array.isArray(detail)
      ? detail.map((d: any) => d.msg || d).join(", ")
      : detail;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export const API_BASE = BASE;
