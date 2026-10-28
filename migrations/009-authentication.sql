BEGIN;
CREATE UNIQUE INDEX users_email_normalized_idx ON users(lower(email));
CREATE TABLE auth_credentials (
 user_id bigint PRIMARY KEY REFERENCES users(id),
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
 token_hash text PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id),
 csrf_token text NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_owner_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE auth_rate_limits (
 key text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 attempts integer NOT NULL
);
COMMIT;
