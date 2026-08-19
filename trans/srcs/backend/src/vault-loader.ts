import { readFileSync } from 'fs';
import { request } from 'https';

interface VaultLoginResponse {
    auth: { client_token: string };
}

interface VaultKvReadResponse {
    data: { data: Record<string, string> };
}

function httpsJson<T>(
    url: URL,
    options: { method: string; headers?: Record<string, string>; ca: Buffer },
    body?: unknown,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = request(
            {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: options.method,
                headers: options.headers,
                ca: options.ca,
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => (raw += chunk));
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Vault request to ${url.pathname} failed: ${res.statusCode} ${raw}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(raw) as T);
                    } catch (err) {
                        reject(err);
                    }
                });
            },
        );
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/**
 * Fetches secrets from Vault via AppRole login and merges them into
 * process.env before Nest's ConfigModule reads it. No-ops if VAULT_ADDR
 * isn't set, so local `npm run start:dev` outside Docker still works off
 * a plain .env file.
 */
export async function loadVaultSecrets(): Promise<void> {
    const vaultAddr = process.env.VAULT_ADDR;
    if (!vaultAddr) return;

    const roleId = readFileSync(process.env.VAULT_ROLE_ID_FILE ?? '/vault/approle/role_id', 'utf-8').trim();
    const secretId = readFileSync(process.env.VAULT_SECRET_ID_FILE ?? '/vault/approle/secret_id', 'utf-8').trim();
    const ca = readFileSync(process.env.VAULT_CACERT ?? '/vault/certs/cert.pem');

    const base = new URL(vaultAddr);

    const login = await httpsJson<VaultLoginResponse>(
        new URL('/v1/auth/approle/login', base),
        { method: 'POST', ca },
        { role_id: roleId, secret_id: secretId },
    );

    const secret = await httpsJson<VaultKvReadResponse>(
        new URL('/v1/secret/data/ft_transcendence', base),
        { method: 'GET', headers: { 'X-Vault-Token': login.auth.client_token }, ca },
    );

    for (const [key, value] of Object.entries(secret.data.data)) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }

    console.log(`Loaded ${Object.keys(secret.data.data).length} secrets from Vault`);
}
