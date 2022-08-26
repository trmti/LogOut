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
              const createdObject = await connection.queryObject`
                INSERT INTO nftMetaDatas (name ,description, image, HP) VALUES (${params.name}, ${params.description}, ${params.image}, ${params.HP}) RETURNING tokenid
              `;
              const createdObjectJson = JSON.parse(
                JSON.stringify(createdObject.rows, null, 2)
              )[0];
              console.log(createdObjectJson.rows);
              return new Response(`{tokenid: ${createdObjectJson.tokenid}}`, {
                headers: { 'Content-Type': 'application/json' },
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
            const query = `UPDATE nftPersonalDatas set damages = damages || '{"(${params.datetime},${params.damage})"}' WHERE id = ${params.id}`;
            if (params.datetime && params.damage && params.id) {
              await connection.queryObject(query);
              return new Response(`Added damage`, { status: 200 });
            }
            return new Response(
              'Insert Value Failed. You may added valid params',
              {
                status: 400,
              }
            );
          }
          case 'addSleepLog': {
            const params = await req.json();
            const query = `UPDATE nftPersonalDatas set sleeps = sleeps || '{"(${params.date},${params.duration})"}' WHERE id = ${params.id}`;
            if (params.date && params.duration && params.id) {
              await connection.queryObject(query);
              return new Response(`Added sleep log`, { status: 200 });
            }
            return new Response(
              'Insert Value Failed. You may added valid params',
              {
                status: 400,
              }
            );
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
                  const createdObject = await connection.queryObject`
                    INSERT INTO nftPersonalDatas (tokenId, tokenOwnerAddress) VALUES (${params.tokenId}, ${params.tokenOwnerAddress}) RETURNING id
                  `;
                  const createdObjectJson = JSON.parse(
                    JSON.stringify(createdObject.rows, null, 2)
                  )[0];
                  console.log(createdObjectJson.rows);
                  return new Response(
                    `{tokenid: ${createdObjectJson.tokenid}}`,
                    {
                      headers: { 'Content-Type': 'application/json' },
                    }
                  );
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

      case 'NFTJsonData': {
        switch (req.method) {
          case 'GET': {
            const id = url.searchParams.get('id');
            const nftPersonalDatas =
              await connection.queryObject`SELECT * FROM nftPersonalDatas WHERE id = ${id}`;
            const nftPersonalDatasJson = JSON.parse(
              JSON.stringify(nftPersonalDatas.rows, null, 2)
            )[0];
            const nftMetaDatas =
              await connection.queryObject`SELECT * FROM nftMetaDatas WHERE tokenId = ${nftPersonalDatasJson.tokenid}`;
            const nftMetaDatasJson = JSON.parse(
              JSON.stringify(nftMetaDatas.rows, null, 2)
            )[0];

            // TODO: SQL文が何度もデータベースにアクセスするため効率が悪い。最適化する。
            const damages = [];
            const sleeps = [];
            const damageLength =
              await connection.queryObject`SELECT damages, ARRAY_LENGTH(damages, 1) from nftpersonaldatas Where id = ${id}`;
            const damageLengthJson = JSON.parse(
              JSON.stringify(damageLength.rows, null, 2)
            )[0];
            const sleepLength =
              await connection.queryObject`SELECT sleeps, ARRAY_LENGTH(sleeps, 1) from nftPersonalDatas where id = ${id}`;
            const sleepLengthJson = JSON.parse(
              JSON.stringify(sleepLength.rows, null, 2)
            )[0];
            for (let i = 1; i < damageLengthJson.array_length + 1; i++) {
              const damage =
                await connection.queryObject`SELECT damages[${i}].date, damages[${i}].damage FROM nftPersonalDatas WHERE id = ${id}`;
              damages.push(damage.rows[0]);
            }
            for (let i = 1; i < sleepLengthJson.array_length + 1; i++) {
              const sleep =
                await connection.queryObject`SELECT sleeps[${i}].date, sleeps[${i}].duration FROM nftPersonalDatas WHERE id = ${id}`;
              sleeps.push(sleep.rows[0]);
            }
            return new Response(
              JSON.stringify({
                tokenId: nftMetaDatasJson.tokenid,
                name: nftMetaDatasJson.name,
                description: nftMetaDatasJson.description,
                image: nftMetaDatasJson.image,
                attributes: {
                  level: nftPersonalDatasJson.level,
                  HP: nftMetaDatasJson.hp,
                  damages: damages,
                  sleeps: sleeps,
                },
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );
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
