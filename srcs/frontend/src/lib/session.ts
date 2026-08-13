// Central place for reading/refreshing the access token. Every page/component that needs
// an auth header or a token for a socket connection should go through getAccessToken()
// (or authHeaders()) instead of reading sessionStorage('token') directly, so the 1-hour
// access token gets silently renewed from the 7-day refresh token instead of forcing a
// re-login every hour.

function decodeExpiry(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
        return null;
    }
}

function isExpired(token: string, bufferSeconds = 30): boolean {
    const exp = decodeExpiry(token);
    if (exp == null) return true;
    return Date.now() >= (exp - bufferSeconds) * 1000;
}

function storeTokens(accessToken: string, refreshToken: string) {
    sessionStorage.setItem('token', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
}

// Multiple components can notice an expired token around the same time (e.g. on page
// load); de-dupe so they all wait on the same in-flight refresh instead of racing to
// spend the same refresh token multiple times.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) {
        clearTokens();
        return null;
    }

    try {
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
            clearTokens();
            return null;
        }
        const data = await res.json();
        storeTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export async function getAccessToken(): Promise<string | null> {
    const token = sessionStorage.getItem('token');
    if (!token) return null;
    if (!isExpired(token)) return token;

    if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

export async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' };
}

export function saveSession(accessToken: string, refreshToken: string) {
    storeTokens(accessToken, refreshToken);
}

export function getRefreshToken(): string | null {
    return sessionStorage.getItem('refreshToken');
}

export function clearSession() {
    clearTokens();
}
