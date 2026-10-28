-- Kept separate from the generic CSV service added by migration 006.
BEGIN;
CREATE TABLE csv_datasets (
 id bigserial PRIMARY KEY,
 filename text NOT NULL,
 uploaded_by bigint REFERENCES users(id),
 created_at timestamptz DEFAULT now()
);
CREATE TABLE employee_leaves (
 id bigserial PRIMARY KEY,
 dataset_id bigint NOT NULL REFERENCES csv_datasets(id) ON DELETE CASCADE,
 name text NOT NULL,
 leaves integer NOT NULL
);
COMMIT;
