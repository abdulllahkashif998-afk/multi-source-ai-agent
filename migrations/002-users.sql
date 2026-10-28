BEGIN;
CREATE TABLE users (
 id bigserial PRIMARY KEY,
 name varchar(150) NOT NULL,
 email varchar(255) NOT NULL UNIQUE,
 created_at timestamptz DEFAULT now()
);
COMMIT;
