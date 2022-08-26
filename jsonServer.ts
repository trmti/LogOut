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
  // CREATE TYPE DAMAGE AS (
  //   date TIMESTAMP,
  //   damage INT
  // );
  // CREATE TYPE SLEEP AS (
  //   date DATE,
  //   duration INT
  // );
  await connection.queryObject`
    CREATE TABLE IF NOT EXISTS nftPersonalDatas (
      id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tokenId INT REFERENCES nftMetaDatas(tokenId),
      tokenOwnerAddress VARCHAR(42) NOT NULL,
      level INT DEFAULT 1,
      damages DAMAGE[],
      sleeps SLEEP[]
    );
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
            if (
              params.name &&
              params.description &&
              params.image &&
              params.HP
            ) {
              await connection.queryObject`
                INSERT INTO nftMetaDatas (name ,description, image, HP) VALUES (${params.name}, ${params.description}, ${params.image}, ${params.HP})
              `;
              return new Response(`Inserted value ${params.name}`, {
                status: 200,
              });
            }
            return new Response('Insert Value Failed. You may mistake params', {
              status: 400,
            });
          }
          default: {
            return new Response('Invalid method', { status: 400 });
          }
        }
      }

      case 'personalData': {
        console.log(urls[2]);
        switch (urls[2]) {
          case 'levelUp': {
            const params = await req.json();
            if (params.level && params.id) {
              await connection.queryObject`
                UPDATE nftPersonalDatas SET level = level + ${params.level} WHERE id = ${params.id}
              `;
              return new Response(`Updated level`, { status: 200 });
            }
            return new Response('Insert Value Failed. You may mistake params', {
              status: 400,
            });
          }
          case 'addDamage': {
            const params = await req.json();
            console.log(
              `UPDATE nftPersonalDatas set damages = damages || '{"(${params.datetime}, ${params.damage})"}' WHERE id = ${params.id}`
            );
            if (params.datetime && params.damage && params.id) {
              await connection.queryObject`
                UPDATE nftPersonalDatas set damages = damages || '{"(${params.datetime},${params.damage})"}' WHERE id = ${params.id}
              `;
              return new Response(`Added damage`, { status: 200 });
            }
            return new Response('Insert Value Failed. You may mistake params', {
              status: 400,
            });
          }
          case 'addSleepLog': {
            const params = await req.json();
            if (params.date && params.duration && params.id) {
              await connection.queryObject`
                INSERT INTO nftPersonalDatas (sleeps) VALUES (ROW(${params.date}, ${params.duration})) WHERE id = ${params.id}
              `;
              return new Response(`Added sleep log`, { status: 200 });
            }
            return new Response('Insert Value Failed. You may mistake params', {
              status: 400,
            });
          }
          default: {
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
                if (params.tokenId && params.tokenOwnerAddress) {
                  await connection.queryObject`
                    INSERT INTO nftPersonalDatas (tokenId, tokenOwnerAddress) VALUES (${params.tokenId}, ${params.tokenOwnerAddress})
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
