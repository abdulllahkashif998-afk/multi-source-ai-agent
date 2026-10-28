-- Base document schema; lifecycle columns/indexes are added by migration 008.
BEGIN;
CREATE TABLE documents (
 id bigserial PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id),
 filename text NOT NULL,
 file_path text NOT NULL,
 file_hash text NOT NULL,
 status varchar(30) NOT NULL DEFAULT 'processing',
 uploaded_at timestamptz DEFAULT now()
);
COMMIT;
