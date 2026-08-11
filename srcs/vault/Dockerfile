FROM hashicorp/vault:1.17

RUN apk add --no-cache jq curl openssl

COPY tools/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV VAULT_ADDR=https://127.0.0.1:8200
ENV VAULT_CACERT=/vault/certs/cert.pem

EXPOSE 8200

ENTRYPOINT ["/entrypoint.sh"]
