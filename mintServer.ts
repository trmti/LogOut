import { serve } from 'https://deno.land/std@0.114.0/http/server.ts';
import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import Web3 from 'https://deno.land/x/web3@v0.11.1/mod.ts';
import { AbiItem } from "https://deno.land/x/web3@v0.11.0/packages/web3-utils/types/index.d.ts";
import GoodNightABI from "./GoodNightToken.json" assert { type: "json" }
import BoostNFTABI from "./BoostNFT.json" assert { type: "json" }

const MINTER_PRIVATE_KEY = Deno.env.get("MINTER_PRIVATE_KEY");
const GNTOKEN_ADDRESS = Deno.env.get("GNTOKEN_ADDRESS");
const PROVIDER_URL = Deno.env.get("PROVIDER_URL");
const BOOSTTOKEN_ADDRESS = Deno.env.get("BOOSTTOKEN_ADDRESS");
const JSON_SERVER_URL = Deno.env.get("JSON_SERVER_URL");

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
  console.log("server runninng");

  serve(async (req) => {
    const url = new URL(req.url);
    
    try {
      switch(url.pathname) {
        case "/mintNFT": {
          const params = await req.json();
          if (params.toAddress && params.tokenId !== undefined) {
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
              const res = await BoostNFTContract.methods.safeMint(params.toAddress, respJson.id).send({from: account.address, gas: 1000000, gasPrice: "8000000000"})
              console.log("create nft successfully!!")
              return new Response(JSON.stringify({nftId: Number(res.events.Transfer.returnValues.tokenId)}), {headers: { 'Content-Type': 'application/json' }})
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
          console.log(params)
          if (params.nftId !== undefined && params.sleepDuration) {
            try {
              const now = Date.now();
              const nowDate = new Date(now);
              const formatedDate = nowDate.getFullYear() + '-' + (nowDate.getMonth()+1) + '-' + nowDate.getDate() + '-';
              const personalId = await BoostNFTContract.methods.getPersonalId(params.nftId).call({from: account.address});
              const nftMetaData = await (await fetch(`${JSON_SERVER_URL}/NFTJsonData?personal_Id=${personalId}`, {
                method: "GET"
              })).json();
              const sleepLog = nftMetaData.sleeps;
              console.log(sleepLog.length);
              let latestDate;
              if (sleepLog.length !== 0) {
                latestDate = new Date(sleepLog[sleepLog.length - 1].date.split(".")[0])
              } else {
                console.log("sleep log is not found")
                latestDate = new Date("2003-12-21T00:00:00")
              }
              if (
                sleepLog.length == 0 ||
                latestDate.getFullYear() < nowDate.getFullYear() ||
                (
                  latestDate.getFullYear() == nowDate.getFullYear() &&
                  latestDate.getMonth() < nowDate.getMonth()
                ) ||
                (
                  latestDate.getFullYear() == nowDate.getFullYear() &&
                  latestDate.getMonth() == nowDate.getMonth() &&
                  latestDate.getDate() < nowDate.getDate()
                )
              ) {
                let durations = 0;
                console.log(sleepLog.length, sleepLog.length !== 0);
                  for (let i = sleepLog.length - 1; i > 0; i--) {
                    console.log("chackpoint")
                    const date = new Date(sleepLog[i].date);
                    const lastDate = Object.assign(nowDate, {});
                    if (date < lastDate) {
                      break;
                    } else {
                      durations += Number(sleepLog[i].duration)
                    }
                  }
                  console.log("durations", durations);
                const body = JSON.stringify(
                  {personalId, sleepDuration: ~~((durations/6 + params.sleepDuration)/2)}
                  )
                  const res = await fetch(`${JSON_SERVER_URL}/calculateMintVol`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body
                  });
                const mintAmount = (await res.json()).vol;
                const mintToAddress = await BoostNFTContract.methods.ownerOf(params.nftId).call();
                console.log("mint Amount", mintAmount)
                console.log("mint address", mintToAddress)
                await GoodNightContract.methods.mint(mintToAddress, ~~(mintAmount * 10 ** 8)).send({from: account.address, gas: 1000000, gasPrice: "8000000000"})

                await fetch(`${JSON_SERVER_URL}/personalData/addSleepLog`, {
                    method: "POST",
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ personalId, duration: params.sleepDuration, date: formatedDate})
                  })
                console.log("mint Successfully!!")
                return new Response("mint Successfully!!", {status: 200})
                }
                else {
                  return new Response("You already inserted sleepLog", {status: 400})
                }
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