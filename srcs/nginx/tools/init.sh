#!/bin/bash
mkdir -p /etc/nginx/certs

if [ ! -f "/etc/nginx/certs/cert.pem" ]; then
    openssl req -x509 -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout /etc/nginx/certs/key.pem \
    -out /etc/nginx/certs/cert.pem \
    -subj "/C=FR/L=Mulhouse/O=42/OU=student/CN=localhost"
fi

exec nginx -g "daemon off;"