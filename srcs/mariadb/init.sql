CREATE DATABASE IF NOT EXISTS ft_transcendence;
USE ft_transcendence;

CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE USER IF NOT EXISTS 'healthcheck'@'localhost';
GRANT USAGE ON *.* TO 'healthcheck'@'localhost';