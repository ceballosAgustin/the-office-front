/**
 * Centralized Admin Session Management (sessionStorage)
 * Safe for SSR and hydration in Astro + React.
 */

export interface AdminSession {
  token: string;
  type: string;
  username: string;
  role: string;
}

const ADMIN_SESSION_KEY = 'the_office_ba_admin_session_v1';
const ADMIN_AUTH_EVENT = 'the-office-ba:admin-auth-changed';

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'ROLE_ADMIN';
}

export function getAdminSession(): AdminSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      !parsed.token.trim() ||
      !isAdminRole(parsed.role)
    ) {
      return null;
    }
    return {
      token: parsed.token,
      type: parsed.type || 'Bearer',
      username: String(parsed.username || 'admin'),
      role: String(parsed.role),
    };
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  const session = getAdminSession();
  return session ? session.token : null;
}

export function saveAdminSession(session: AdminSession): void {
  if (!isBrowser()) return;
  if (!isAdminRole(session.role)) {
    throw new Error('Solo se permite almacenar sesiones con rol ADMIN.');
  }
  try {
    const cleanSession: AdminSession = {
      token: session.token,
      type: session.type || 'Bearer',
      username: session.username,
      role: session.role,
    };
    window.sessionStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify(cleanSession)
    );
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT, { detail: cleanSession }));
  } catch {
    // Ignore storage errors
  }
}

export function clearAdminSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT, { detail: null }));
  } catch {
    // Ignore storage errors
  }
}

export function onAdminAuthChange(
  callback: (session: AdminSession | null) => void
): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => {
    callback(getAdminSession());
  };
  window.addEventListener(ADMIN_AUTH_EVENT, handler);
  return () => {
    window.removeEventListener(ADMIN_AUTH_EVENT, handler);
  };
}

