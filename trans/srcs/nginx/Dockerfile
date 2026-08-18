FROM debian:bookworm

RUN apt-get update && apt-get install -y \
    nginx \
    openssl \
    libnginx-mod-http-modsecurity \
    modsecurity-crs \
    && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/nginx.conf
COPY tools/init.sh /init.sh

RUN chmod +x /init.sh

EXPOSE 443

CMD ["/init.sh"]