import { timedQuery } from './db';
import { requireUserId } from './identity';
import pool from "@/src/lib/db";
import { parseCSV } from "@/src/lib/parse-csv";

export async function importCSV(
  filename: string,
  content: string
) {
  const userId=requireUserId();
  const rows = parseCSV(content);

  if (rows.length === 0) {
    throw new Error("CSV contains no records");
  }

  const client = await pool.connect();

  try {
    await timedQuery(()=>client.query("BEGIN"));

    const dataset = await timedQuery(()=>client.query(
      `INSERT INTO csv_datasets (filename,uploaded_by)
       VALUES ($1,$2)
       RETURNING id`,
      [filename,userId]
    ));

    const datasetId = dataset.rows[0].id;

    for (const row of rows) {
      const name = row.name?.trim();
      const leaves = Number(row.leaves);

      if (!name || row.leaves?.trim() === "" ||
          !Number.isSafeInteger(leaves) || leaves < 0) {
        throw new Error("Invalid employee record");
      }

      await timedQuery(()=>client.query(
        `INSERT INTO employee_leaves
         (dataset_id, name, leaves)
         VALUES ($1, $2, $3)`,
        [datasetId, name, leaves]
      ));
    }

    await timedQuery(()=>client.query("COMMIT"));

    return {
      datasetId,
      importedRows: rows.length,
    };
  } catch (error) {
    await timedQuery(()=>client.query("ROLLBACK"));
    throw error;
  } finally {
    client.release();
  }
}