
import pool from "../lib/db";
import { generateEmbedding } from "../lib/embeddings";

async function main() {
  const result = await pool.query(
    `SELECT id, chunk_text
     FROM document_chunks
     ORDER BY id`
  );

  console.log(`Found ${result.rows.length} chunks`);

  // Generate all embeddings before changing the database
  const updates = [];

  for (const row of result.rows) {
    const embedding = await generateEmbedding(row.chunk_text);

    updates.push({
      id: row.id,
      embedding,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of updates) {
      await client.query(
        `UPDATE document_chunks
         SET embedding = $1::vector
         WHERE id = $2`,
        [JSON.stringify(item.embedding), item.id]
      );
    }

    await client.query("COMMIT");

    console.log(`Updated ${updates.length} embeddings`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
