BEGIN;
CREATE TABLE generic_csv_datasets (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id),
 filename text NOT NULL,
 columns jsonb NOT NULL,
 status text NOT NULL CHECK (status IN ('importing','ready')),
 row_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE generic_csv_rows (
 dataset_id bigint NOT NULL REFERENCES generic_csv_datasets(id),
 row_index integer NOT NULL,
 data jsonb NOT NULL,
 PRIMARY KEY(dataset_id,row_index)
);
CREATE INDEX generic_csv_owner ON generic_csv_datasets(user_id,id);
COMMIT;
