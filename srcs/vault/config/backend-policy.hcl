# ============================================================
#  ft_transcendence — backend Vault policy
#  Read-only access to exactly one secret path. The backend can
#  never list, write, or delete secrets, and has no access to
#  Vault's own system/auth/policy management endpoints.
# ============================================================

path "secret/data/ft_transcendence" {
  capabilities = ["read"]
}
