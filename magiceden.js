import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import colors from "colors";
import { DateTime } from "luxon";
import { HttpsProxyAgent } from "https-proxy-agent";
import "dotenv/config";
import { Evm } from "./helper/evm_wallet.js";
import collection_id from "./collection.js";
const __dirname = path.resolve();

//#region ABI

//#endregion Contract

//#region

class Account {
  constructor(index, privateKey, proxy) {
    this.index = index;
    this.privateKey = privateKey;
    let [ip, port, user, password] = proxy.split(":");
    this.proxy = `http://${user}:${password}@${ip}:${port}`;
    this.web3 = new Evm(this.privateKey, this.proxy);
    this.address = this.web3.address;
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
      "Accept-Language": "vi-VN,vi",
      origin: "https://magiceden.io",
      referer: "https://magiceden.io/",
      "content-type": "application/json",
    };
  }

  log(message, level = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const accountPrefix = `[${timestamp}][Tài khoản ${this.index + 1}]`;
    const colorsMap = {
      success: "green",
      error: "red",
      warning: "yellow",
      info: "blue",
    };
    console.log(colors[colorsMap[level]](accountPrefix + " " + message));
  }
  async random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  getRandomString(length) {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }
  async sleep(time) {
    await new Promise((resolve) => setTimeout(resolve, time));
  }
  async http(url, header = null, data = null) {
    try {
      const agent = this.proxy ? new HttpsProxyAgent(`${this.proxy}`) : null;

      const options = {
        headers: header ? { ...this.headers, header } : this.headers,
        timeout: 10000,
        httpsAgent: agent,
      };
      const response = data
        ? await axios.post(url, data, options)
        : await axios.get(url, options);
      return response;
    } catch (error) {
      this.log(`HTTP error: ${error.message}`, "error");
      throw error;
    }
  }
  async getInfoGas(contractAddress, fee, data) {
    try {
      const gasPrice = await this.web3.web3.eth.getGasPrice();
      const gasEstimate = await this.web3.web3.eth.estimateGas({
        from: this.address,
        to: contractAddress,
        data: data,
        value: fee,
      });
      const tx = {
        from: this.address,
        to: contractAddress,
        gas: gasEstimate,
        gasPrice: gasPrice,
        data: data,
        value: fee,
      };
      return tx;
    } catch (error) {
      this.log(`Catch get tx: ${error.message}`, "error");
      return false;
    }
  }
  async hanlde_mint_NFT() {
    try {
      const random_index = await this.random(0, collection_id.length);
      const nft_id = collection_id[random_index];
      const params = await this.mint_token(nft_id);
      if (params) {
        const tx = await this.getInfoGas(params.to, params.value, params.data);
        if (tx) {
          const total =
            Number(params.value) + Number(tx.gas) * Number(tx.gasPrice);
          const weiFee = this.web3.web3.utils.fromWei(total, "ether");
          this.log(`Mint NFT total fee: ${weiFee} Mon`, "warning");
          const result_trans = await this.web3.sign_and_send(tx);
          if (result_trans) {
            this.log(`Mint NFT tx: ${result_trans}`, "success");
          } else {
            this.log(`Mint NFT fail`, "error");
          }
        }
      } else {
      }
    } catch (error) {
      this.log(`Catch handle mint NFT: ${error.message}`, "error");
    }
  }
  async mint_token(nft) {
    const payload = {
      chain: "monad-testnet",
      collectionId: nft,
      wallet: {
        address: this.address,
        chain: "monad-testnet",
      },
      nftAmount: 1,
      kind: "public",
      protocol: "ERC1155",
      tokenId: 0,
    };
    const response = await axios.post(
      "https://api-mainnet.magiceden.us/v4/self_serve/nft/mint_token",
      payload,
      { headers: this.headers }
    );
    if (response.status == 200) {
      const params = response.data?.steps[0].params;
      return params;
    } else {
      return false;
    }
  }

  async checkIP() {
    try {
      const response = await this.http("https://api.ipify.org?format=json");
      return response.data.ip;
    } catch (error) {
      return "Unknown IP";
    }
  }

  async processAccount() {
    try {
      const ip = await this.checkIP();
      this.log(`IP: ${ip}`, "success");
      await this.hanlde_mint_NFT();
      const time = await this.random(10000, 15000);
      await this.sleep(time);
    } catch (error) {
      this.log(`Error processing account: ${error.message}`, "error");
    }
  }
}

async function main() {
  const dataFile = path.join(__dirname, "data.txt");
  const configFile = path.join(__dirname, "config.json");

  if (!fs.existsSync(dataFile)) {
    console.log("data.txt file not found!");
    return;
  }

  const data = fs.readFileSync(dataFile, "utf8").split("\r\n").filter(Boolean);
  const proxys = fs
    .readFileSync("proxy.txt", "utf8")
    .split("\r\n")
    .filter(Boolean);
  const config = fs.existsSync(configFile)
    ? JSON.parse(fs.readFileSync(configFile, "utf8"))
    : { maxThreads: 5, waitMinutes: 1440 };
  const maxThreads = config.maxThreads || 5;
  const waitMinutes = config.waitMinutes || 1440;

  const accounts = data.map((line, index) => {
    const proxy = proxys[index];
    const privateKey = line;
    return new Account(index, privateKey, proxy);
  });

  while (true) {
    const queue = accounts.slice();
    const activeThreads = new Set();

    const runNext = async () => {
      if (queue.length === 0) return;
      const account = queue.shift();
      activeThreads.add(account);
      await account.processAccount();
      activeThreads.delete(account);
      runNext();
    };

    for (let i = 0; i < maxThreads && queue.length > 0; i++) {
      runNext();
    }

    while (activeThreads.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `Hoàn thành tất cả tài khoản, chờ ${waitMinutes} phút để tiếp tục...`
    );
    await new Promise((resolve) =>
      setTimeout(resolve, waitMinutes * 60 * 1000)
    );
  }
}

main().catch(console.error);
