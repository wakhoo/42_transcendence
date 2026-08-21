# ============================================================
#  ft_transcendence — Vault server config
#  File storage backend (single-node, matches the project's
#  Inception-style docker-compose deployment). TLS-only listener.
# ============================================================

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/certs/cert.pem"
  tls_key_file  = "/vault/certs/key.pem"
}

api_addr     = "https://vault:8200"
cluster_addr = "https://vault:8201"

disable_mlock = false

ui = true
