import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import Base64 from 'crypto-js/enc-base64';
import axios, { isAxiosError } from 'axios';
import { supabase } from './supabase';

type SignedHeadersInput = {
  method: string;
  path: string;
  body?: unknown;
};

type HmacSession = {
  keyId: string;
  secretB64: string;
  expiresAt: number; // unix seconds
};

// NOTE: SecureStore keys must be non-empty and contain only:
// [A-Za-z0-9._-]
// (colon `:` is NOT allowed)
const HMAC_KEY_ID_STORE = 'locaface.hmac.key_id';
const HMAC_SECRET_STORE = 'locaface.hmac.secret_b64';
const HMAC_EXPIRES_AT_STORE = 'locaface.hmac.expires_at';

const safeGet = async (key: string) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const safeSet = async (key: string, value: string) => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
};

const safeDelete = async (key: string) => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
};

// const getAiBaseUrl = () => process.env.EXPO_PUBLIC_AI_SERVICE_URL;
export const getAiBaseUrl = () => 'http://your-ai-service.com'; // TODO: set this in env

const loadHmacSession = async (): Promise<HmacSession | null> => {
  const [keyId, secretB64, expiresAtStr] = await Promise.all([
    safeGet(HMAC_KEY_ID_STORE),
    safeGet(HMAC_SECRET_STORE),
    safeGet(HMAC_EXPIRES_AT_STORE),
  ]);

  if (!keyId || !secretB64 || !expiresAtStr) return null;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt)) return null;

  return { keyId, secretB64, expiresAt };
};

const saveHmacSession = async (session: HmacSession) => {
  await Promise.all([
    safeSet(HMAC_KEY_ID_STORE, session.keyId),
    safeSet(HMAC_SECRET_STORE, session.secretB64),
    safeSet(HMAC_EXPIRES_AT_STORE, String(session.expiresAt)),
  ]);
};

export const clearHmacSession = async () => {
  await Promise.all([
    safeDelete(HMAC_KEY_ID_STORE),
    safeDelete(HMAC_SECRET_STORE),
    safeDelete(HMAC_EXPIRES_AT_STORE),
  ]);
};

export const ensureHmacSession = async (accessToken: string) => {
  // In-flight lock to avoid parallel /hmac/issue calls.
  // If another call is already issuing, wait for it to finish.
  // We keep the lock at module scope.
  if ((ensureHmacSession as any)._inFlight) {
    return (ensureHmacSession as any)._inFlight as Promise<void>;
  }

  const doEnsure = async () => {
    const existing = await loadHmacSession();
    const now = Math.floor(Date.now() / 1000);

    // Refresh slightly before expiry.
    if (existing && existing.expiresAt - now > 60) return;

    const issueHmac = async (token: string) => {
      const res = await fetch(`${getAiBaseUrl()}/hmac/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to issue HMAC key: ${res.status} ${text}`);
      }

      const data = (await res.json()) as { key_id: string; secret_b64: string; expires_at: number };
      await saveHmacSession({ keyId: data.key_id, secretB64: data.secret_b64, expiresAt: data.expires_at });
    };

    try {
      await issueHmac(accessToken);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? '');
      const isAuthError = message.includes('Failed to issue HMAC key: 401');

      if (!isAuthError) throw error;

      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token;

      if (!refreshedToken) {
        throw error;
      }

      await issueHmac(refreshedToken);
    }
  };

  const p = doEnsure();
  (ensureHmacSession as any)._inFlight = p;
  try {
    await p;
  } finally {
    (ensureHmacSession as any)._inFlight = null;
  }
};

export const getSignedHeaders = async ({ method, path, body }: SignedHeadersInput) => {
  const session = await loadHmacSession();
  if (!session) throw new Error('HMAC session missing; call ensureHmacSession() first');

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = Crypto.randomUUID();

  const bodyString = body === undefined ? '' : JSON.stringify(body);
  const bodySha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, bodyString);

  const canonical = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodySha256}`;

  const secretBytes = Base64.parse(session.secretB64);
  const signature = Base64.stringify(HmacSHA256(canonical, secretBytes));

  console.debug("user id requested", session.keyId, { method, path, timestamp, nonce, bodySha256, signature });

  return {
    'x-hmac-key-id': session.keyId,
    'x-hmac-timestamp': timestamp,
    'x-hmac-nonce': nonce,
    'x-body-sha256': bodySha256,
    'x-hmac-signature': signature,
  } as const;
};

// --- Convenience signed request helpers ---
export const signedPost = async (path: string, body: unknown, accessToken: string) => {
  if (!accessToken) throw new Error('accessToken required for signedPost');

  const requestOnce = async (token: string) => {
    await ensureHmacSession(token);
    const headers = await getSignedHeaders({ method: 'POST', path, body });
    const url = `${getAiBaseUrl()}${path}`;
    return axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 60_000,
    });
  };

  try {
    return await requestOnce(accessToken);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      await clearHmacSession();

      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token;
      if (!refreshedToken) throw error;

      return requestOnce(refreshedToken);
    }
    throw error;
  }
};

export const signedGet = async (
  path: string,
  params: Record<string, string | number | boolean> | undefined,
  accessToken: string
) => {
  if (!accessToken) throw new Error('accessToken required for signedGet');
  const qs = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
  const fullPath = qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;

  const requestOnce = async (token: string) => {
    await ensureHmacSession(token);
    const headers = await getSignedHeaders({ method: 'GET', path: fullPath });
    const url = `${getAiBaseUrl()}${fullPath}`;
    return axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      timeout: 60_000,
    });
  };

  try {
    return await requestOnce(accessToken);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      await clearHmacSession();

      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token;
      if (!refreshedToken) throw error;

      return requestOnce(refreshedToken);
    }
    throw error;
  }
};

const TIME_SYNC_THRESHOLD_MS = 60_000;

export const checkSystemTimeSync = async () => {
  try {
    const response = await fetch(`${getAiBaseUrl()}/`, {
      method: 'GET',
    });

    const serverDateHeader = response.headers.get('date');
    if (!serverDateHeader) {
      return { inSync: true, diffMs: 0, checked: false };
    }

    const serverTimeMs = new Date(serverDateHeader).getTime();
    if (!Number.isFinite(serverTimeMs)) {
      return { inSync: true, diffMs: 0, checked: false };
    }

    const deviceTimeMs = Date.now();
    const diffMs = Math.abs(deviceTimeMs - serverTimeMs);

    return {
      inSync: diffMs <= TIME_SYNC_THRESHOLD_MS,
      diffMs,
      checked: true,
    };
  } catch {
    return { inSync: true, diffMs: 0, checked: false };
  }
};
