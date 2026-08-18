FROM mariadb:11

COPY init.sql /docker-entrypoint-initdb.d/
COPY healthcheck.cnf /etc/mysql/conf.d/healthcheck.cnf

EXPOSE 3306