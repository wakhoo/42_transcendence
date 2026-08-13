#!/bin/sh
set -e

export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_CACERT=/vault/certs/cert.pem

# ------------------------------------------------------------------
# TLS cert for the Vault listener (same self-signed pattern as nginx)
# ------------------------------------------------------------------
mkdir -p /vault/certs
if [ ! -f /vault/certs/cert.pem ]; then
    openssl req -x509 -nodes \
        -days 365 \
        -newkey rsa:2048 \
        -keyout /vault/certs/key.pem \
        -out /vault/certs/cert.pem \
        -subj "/C=FR/L=Mulhouse/O=42/OU=student/CN=vault" \
        -addext "subjectAltName=DNS:vault,DNS:localhost,IP:127.0.0.1"
fi

# ------------------------------------------------------------------
# Start the Vault server in the background
# ------------------------------------------------------------------
vault server -config=/vault/config/vault.hcl &
VAULT_PID=$!
trap 'kill -TERM $VAULT_PID 2>/dev/null; wait $VAULT_PID' TERM INT

echo "[vault-entrypoint] waiting for vault to come up..."
until curl -s --cacert "$VAULT_CACERT" "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; do
    sleep 1
done

INIT_FILE=/vault/data/.init.json

# ------------------------------------------------------------------
# Init (first boot only) / unseal (every boot)
# ------------------------------------------------------------------
if vault status -format=json 2>/dev/null | jq -e '.initialized == false' >/dev/null; then
    echo "[vault-entrypoint] first boot: running vault operator init"
    vault operator init -key-shares=5 -key-threshold=3 -format=json > "$INIT_FILE"
    chmod 600 "$INIT_FILE"
else
    echo "[vault-entrypoint] vault already initialized, reusing stored keys"
fi

if vault status -format=json | jq -e '.sealed == true' >/dev/null; then
    echo "[vault-entrypoint] unsealing"
    for i in 0 1 2; do
        KEY=$(jq -r ".unseal_keys_b64[$i]" "$INIT_FILE")
        vault operator unseal "$KEY" >/dev/null
    done
fi

ROOT_TOKEN=$(jq -r '.root_token' "$INIT_FILE")
export VAULT_TOKEN="$ROOT_TOKEN"

# ------------------------------------------------------------------
# Idempotent one-time setup: secrets engine, AppRole auth, policy,
# role, and seeding the actual application secrets.
# ------------------------------------------------------------------
if ! vault secrets list -format=json | jq -e 'has("secret/")' >/dev/null; then
    echo "[vault-entrypoint] enabling kv-v2 at secret/"
    vault secrets enable -path=secret kv-v2
fi

if ! vault auth list -format=json | jq -e 'has("approle/")' >/dev/null; then
    echo "[vault-entrypoint] enabling approle auth"
    vault auth enable approle
fi

echo "[vault-entrypoint] writing backend-policy"
vault policy write backend-policy /vault/config/backend-policy.hcl >/dev/null

vault write auth/approle/role/backend-role \
    token_policies=backend-policy \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=0 >/dev/null

mkdir -p /vault/approle
vault read -field=role_id auth/approle/role/backend-role/role-id > /vault/approle/role_id
# 644, not 600: this file is read cross-container by the backend's own
# unprivileged user over a bind mount (different UID than this
# container's), and /vault/approle isn't reachable from outside the two
# containers that mount it. role_id alone is not a usable credential
# without the matching secret_id.
chmod 644 /vault/approle/role_id

# Only mint a secret_id once — it's long-lived (secret_id_ttl=0), so
# regenerating it on every restart would just accumulate valid
# credentials in Vault instead of reusing the one the backend has.
if [ ! -f /vault/approle/secret_id ]; then
    echo "[vault-entrypoint] minting backend secret_id"
    vault write -f -field=secret_id auth/approle/role/backend-role/secret-id > /vault/approle/secret_id
    chmod 644 /vault/approle/secret_id
fi

# Seed application secrets exactly once. seed.env is a first-boot input,
# not a live source of truth — later changes should go through Vault
# directly (`vault kv put`), not by re-editing seed.env.
if ! vault kv get -format=json secret/ft_transcendence >/dev/null 2>&1; then
    if [ -f /vault/config/seed.env ]; then
        echo "[vault-entrypoint] seeding secret/ft_transcendence from seed.env"
        set -a
        . /vault/config/seed.env
        set +a
        vault kv put secret/ft_transcendence \
            JWT_SECRET="$JWT_SECRET" \
            NESTAUTH_SECRET="$NESTAUTH_SECRET" \
            MARIADB_ROOT_PASSWORD="$MARIADB_ROOT_PASSWORD" \
            MARIADB_PASSWORD="$MARIADB_PASSWORD" \
            OAUTH_GOOGLE_CLIENT_ID="$OAUTH_GOOGLE_CLIENT_ID" \
            OAUTH_GOOGLE_CLIENT_SECRET="$OAUTH_GOOGLE_CLIENT_SECRET" \
            TOTP_ISSUER="$TOTP_ISSUER" \
            GMAIL_APP_PASSWORD="$GMAIL_APP_PASSWORD" >/dev/null
    else
        echo "[vault-entrypoint] WARNING: no /vault/config/seed.env found, secret/ft_transcendence not seeded"
    fi
fi

unset VAULT_TOKEN

echo "[vault-entrypoint] ready"
wait $VAULT_PID
