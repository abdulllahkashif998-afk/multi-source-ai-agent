BEGIN;
CREATE TABLE document_chunks (
 id bigserial PRIMARY KEY,
 document_id bigint NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 chunk_index integer NOT NULL,
 chunk_text text NOT NULL,
 embedding vector(768),
 page_number integer,
 UNIQUE(document_id,chunk_index)
);
COMMIT;
