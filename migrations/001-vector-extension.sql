-- Fresh installation prerequisite. Requires pgvector installed on the server.
-- Run with a migration administrator, never automatically against an existing DB.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
COMMIT;
