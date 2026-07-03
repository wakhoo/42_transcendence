CREATE DATABASE IF NOT EXISTS ft_transcendence;
USE ft_transcendence;

CREATE TABLE IF NOT EXISTS users (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    username        VARCHAR(20)   NOT NULL UNIQUE,
    password_hash   VARCHAR(60)   DEFAULT NULL,
    avatar_url      VARCHAR(500)  DEFAULT NULL,
    totp_secret     VARCHAR(255)  DEFAULT NULL,
    is_2fa_enabled  BOOLEAN       DEFAULT FALSE,
    oauth_provider  VARCHAR(20)   DEFAULT NULL,
    oauth_id        VARCHAR(255)  DEFAULT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    user_id     INT           NOT NULL,
    token_hash  VARCHAR(255)  NOT NULL,
    expires_at  TIMESTAMP     NOT NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
                           ON DELETE CASCADE
);
