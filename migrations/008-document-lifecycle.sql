BEGIN;
ALTER TABLE documents
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 ADD COLUMN replaces_document_id bigint REFERENCES documents(id),
 ADD COLUMN retired_at timestamptz,
 ADD COLUMN deleted_at timestamptz;
CREATE UNIQUE INDEX documents_active_owner_hash_idx ON documents(user_id,file_hash) WHERE status='ready';
CREATE TABLE document_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id bigint NOT NULL REFERENCES documents(id),
 user_id bigint NOT NULL REFERENCES users(id),
 action text NOT NULL CHECK(action IN ('uploaded','replaced','deleted')),
 related_document_id bigint REFERENCES documents(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE document_file_cleanup (
 document_id bigint PRIMARY KEY REFERENCES documents(id),
 queued_at timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz,
 attempts integer NOT NULL DEFAULT 0
);
COMMIT;
