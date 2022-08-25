import { serve } from 'https://deno.land/std@0.114.0/http/server.ts';
import * as postgres from 'https://deno.land/x/postgres@v0.14.2/mod.ts';

// Get the connection string from the environment variable "DATABASE_URL"
const databaseUrl = Deno.env.get('DATABASE_URL')!;

// Create a database pool with three connections that are lazily established
const pool = new postgres.Pool(databaseUrl, 3, true);

// Connect to the database
const connection = await pool.connect();
try {
  // Create the table
  await connection.queryObject`
    CREATE TABLE IF NOT EXISTS nftMetaDatas (
      tokenId SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL
    )
  `;
  await connection.queryObject`
    CREATE TABLE IF NOT EXISTS nftPersonalDatas (
      id SERIAL PRIMARY KEY,
      tokenId SERIAL REFERENCES nftMetaDatas(tokenId),
      level INTEGER NOT NULL,
      damages INTEGER[][2] NOT NULL
    )
  `;
} finally {
  // Release the connection back into the pool
  connection.release();
}

serve(async (req) => {
  const url = new URL(req.url);
  const connection = await pool.connect();

  try {
    switch (url.pathname) {
      case '/nft': {
        const nftMetaDatas = await connection.queryObject`
          SELECT * FROM nftMetaDatas
        `;
        const body = JSON.stringify(nftMetaDatas.rows, null, 2);
        console.log(body);
        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      default: {
        return new Response('not Found', { status: 404 });
      }
    }
  } catch {
    return new Response('Not Found', {
      status: 404,
    });
  } finally {
    connection.release();
  }
});
