import { serve } from 'https://deno.land/std@0.114.0/http/server.ts';
import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import Web3 from 'https://deno.land/x/web3@v0.11.1/mod.ts';
import { AbiItem } from "https://deno.land/x/web3@v0.11.0/packages/web3-utils/types/index.d.ts";
import GoodNightABI from "./GoodNightToken.json" assert { type: "json" }
import BoostNFTABI from "./BoostNFT.json" assert { type: "json" }

const MINTER_PRIVATE_KEY = Deno.env.get("MINTER_PRIVATE_KEY");
const GNTOKEN_ADDRESS = Deno.env.get("GNTOKEN_ADDRESS")
const PROVIDER_URL = Deno.env.get("PROVIDER_URL")
const BOOSTTOKEN_ADDRESS = Deno.env.get("BOOSTTOKEN_ADDRESS")
const JSON_SERVER_URL = Deno.env.get("JSON_SERVER_URL")

let web3;

if (MINTER_PRIVATE_KEY && GNTOKEN_ADDRESS && PROVIDER_URL && BOOSTTOKEN_ADDRESS && JSON_SERVER_URL) {
    web3 = new Web3(
    PROVIDER_URL
  );
  const account = web3.eth.accounts.privateKeyToAccount(MINTER_PRIVATE_KEY);
  const GoodNightContract = new web3.eth.Contract(GoodNightABI as AbiItem[], GNTOKEN_ADDRESS);
  const BoostNFTContract = new web3.eth.Contract(BoostNFTABI as AbiItem[], BOOSTTOKEN_ADDRESS);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;
  console.log("server runninng")

  serve(async (req) => {
    const url = new URL(req.url);
    
    try {
      switch(url.pathname) {
        case "/mintNFT": {
          const params = await req.json();
          if (params.toAddress && params.tokenId) {
            try {
              const body =
                {
                  "tokenId": params.tokenId,
                  "tokenOwnerAddress": params.toAddress
                }
              const resp = await fetch(`${JSON_SERVER_URL}/personalData`, {
                method: "POST",
                headers: {
                "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
              })
              const respJson = await resp.json();
              await BoostNFTContract.methods.safeMint(params.toAddress, respJson[0].id).send({from: account.address, gas: 1000000, gasPrice: "8000000000"})
              return new Response("create nft successfully!!", {status: 200})
            } catch(e) {
              console.error(e);
              return new Response("create nft failed", {status: 400})
            }
          } else {
            return new Response(
              'Insert Value Failed. You may added invalid params',
              {
                status: 400,
              }
            )
          }
        }

        case "/mintToken": {
          const params = await req.json();
          if (params.nftId && params.sleepDuration) {
            try {
              const now = Date.now();
              const date = new Date(now);
              const formatedDate = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate() + '-';
              await fetch(`${JSON_SERVER_URL}/personalData/addSleepLog`, {
                  method: "POST",
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({id: params.nftId, duration: params.sleepDuration, date: formatedDate})
                }
              )
              const nftMetaData = await (await fetch(`${JSON_SERVER_URL}/NFTJsonData`)).json();
              const sleepLog = nftMetaData.sleeps;
              console.log(sleepLog);
              return new Response("mint Successfully!!", {status: 200})
            } catch(e) {
              console.error(e);
              return new Response("Internal Server Error", {status: 400})
            }
          } else {
            return new Response(
              'Insert Value Failed. You may added invalid params',
              { status: 400 }
            )
          }
        }
        default: {
          return new Response('not Found', { status: 404 });
        }
      }
    } catch(e) {
      console.error(e);
      return new Response('Internal Server Error', {
        status: 500,
      });
    }
  })
} else {
  console.error('環境変数が正しく設定されていません');
}