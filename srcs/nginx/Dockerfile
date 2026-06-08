FROM debian:bookworm

RUN apt-get update && apt-get install -y \
    nginx \
    openssl \
    libnginx-mod-http-modsecurity \
    && rm -rf /var/lib/apt/lists/*

COPY conf/default.conf /etc/nginx/nginx.conf
COPY tools/init.sh /init.sh

RUN chmod +x /init.sh

EXPOSE 443

CMD ["/init.sh"]