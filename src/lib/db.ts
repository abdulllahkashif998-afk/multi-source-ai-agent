import { measure } from './reliability';
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

// Instrument the promise query API used by this project; SQL and values never enter logs.
export async function timedQuery<T>(work:()=>Promise<T>):Promise<T> { return measure('postgres',work); }
export default pool;
