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
      tokenId INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      HP FLOAT NOT NULL)
  `;
  await connection.queryObject`
    CREATE TYPE damage AS (
      date TIMESTAMP
      damage INT
    )
    CREATE TYPE sleep AS (
      date DATE
      duration INT
    )
    CREATE TABLE IF NOT EXISTS nftPersonalDatas (
      id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tokenId INT REFERENCES nftMetaDatas(tokenId),
      level INT DEFAULT 1,
      damages damage[],
      sleeps sleep[]
    )
  `;
} catch (e) {
  console.error(e);
} finally {
  // Release the connection back into the pool
  connection.release();
}

serve(async (req) => {
  const url = new URL(req.url);
  const urls = url.pathname.split('/');
  const connection = await pool.connect();

  try {
    switch (urls[1]) {
      case 'metaData': {
        switch (req.method) {
          case 'GET': {
            const nftMetaDatas = await connection.queryObject`
              SELECT * FROM nftMetaDatas
            `;
            const body = JSON.stringify(nftMetaDatas.rows, null, 2);
            return new Response(body, {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          case 'POST': {
            const params = await req.json();
            if (params !== null) {
              await connection.queryObject`
                INSERT INTO nftMetaDatas (name ,description, image, HP) VALUES (${params.name}, ${params.description}, ${params.image}, ${params.HP})
              `;
              return new Response(`Inserted value ${params.name}`, {
                status: 200,
              });
            } else {
              return new Response('Insert Value Failed', { status: 500 });
            }
          }
          default: {
            return new Response('Invalid method', { status: 400 });
          }
        }
      }

      case 'personalData': {
        console.log(urls[2]);
        switch (req.method) {
          case 'GET': {
            const nftPersonalDatas = await connection.queryObject`
              SELECT * FROM nftPersonalDatas
            `;
            const body = JSON.stringify(nftPersonalDatas.rows, null, 2);
            return new Response(body, {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          case 'POST': {
            const params = await req.json();
            if (params !== null) {
              await connection.queryObject`
                INSERT INTO nftPersonalDatas (tokenId) VALUES (${params.tokenId})
              `;
              return new Response(`Inserted value ${params.tokenId}`, {
                status: 200,
              });
            } else {
              return new Response('Insert Value Failed', { status: 500 });
            }
          }
          default: {
            return new Response('Invalid method', { status: 400 });
          }
        }
      }

      default: {
        return new Response('not Found', { status: 404 });
      }
    }
  } catch (e) {
    console.error(e);
    return new Response('Internal Server Error', {
      status: 500,
    });
  } finally {
    connection.release();
  }
});
