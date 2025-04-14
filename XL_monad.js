import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import colors from "colors";
import { DateTime } from "luxon";
import { getClientTele, getIframeUrl } from "./helper/tele.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import "dotenv/config";
import { Evm } from "./helper/evm_wallet.js";
import { Web3 } from "web3";
import axiosRetry from "axios-retry";
import { monadTestnet } from "viem/chains";
import { ethers } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  http,
  parseSignature,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";

const RPC = "https://testnet-rpc.monad.xyz/";

const provider = new ethers.JsonRpcProvider(RPC);
const __dirname = path.resolve();
//#region ABI
const abi_balance = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
];
const abi_buyForETH = [
  {
    type: "function",
    name: "buyForETH",
    inputs: [
      {
        name: "buyer",
        type: "address",
        internalType: "address",
      },
      {
        name: "reserveAmountIn",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "supplyAmountOutMin",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "payable",
  },
];
const abi_estimateBuy = [
  {
    type: "function",
    name: "estimateBuy",
    inputs: [
      {
        name: "reserveAmountIn",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
];
const abi_estimateSell = [
  {
    type: "function",
    name: "estimateSell",
    inputs: [
      {
        name: "supplyAmountIn",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
];
const abi_get_nonce = [
  {
    type: "function",
    name: "nonces",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
];
const abi_get_name = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "string",
      },
    ],
  },
];
const abi_aggregate3Value = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bool",
            name: "allowFailure",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
        ],
        internalType: "struct Multicall3.Call3Value[]",
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3Value",
    outputs: [
      {
        components: [
          {
            internalType: "bool",
            name: "success",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "returnData",
            type: "bytes",
          },
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
];
const abi_permit = [
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "v",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "r",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "s",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "permit",
  },
];
const abi_sellForETH = [
  {
    inputs: [
      {
        internalType: "address",
        name: "seller",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "supplyAmountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "reserveAmountOutMin",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "sellForETH",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
  },
];
const abi_supplyToken = [
  {
    constant: true,
    inputs: [],
    name: "supplyToken",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

//#endregion
//#region CONTRACT
const contract_XL = "0xd0e2Af58F3A578701Cc7A2b37Be2E06CA7C1Bbae";
const contract_SELL = "0xcA11bde05977b3631167028862bE2a173976CA11";
//#endregion
//#region Token
const list_token = [
  {
    name: "Mega",
    CA: "0x10a6be7d23989d00d528e68cf8051d095f741145",
  },
  {
    name: "KZUKI",
    CA: "0xa626f15d10f2b30af1fb0d017f20a579500b5029",
  },
  {
    name: "GTE",
    CA: "0x9629684df53db9e4484697d0a50c442b2bfa80a8",
  },
  {
    name: "Capybara",
    CA: "0x3584fa9005c9fd0a909407d018a04ce7fb128170",
  },
  {
    name: "Bitcoin",
    CA: "0x98ded6bda76abe846c7a881d6e6cb564303bf0cf",
  },
];
//#endregion

const pubClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC),
  batch: {
    multicall: {
      batchSize: 1024 * 200,
    },
  },
});
class Account {
  constructor(index, privateKey, web3, proxy) {
    this.index = index;
    this.privateKey = privateKey;
    let [ip, port, user, password] = proxy.split(":");
    this.proxy = `http://${user}:${password}@${ip}:${port}`;
    this.web3 = web3;
    this.walletClient = createWalletClient({
      chain: monadTestnet,
      transport: http(RPC),
      account: privateKeyToAccount(this.privateKey),
    });
    this.address = this.web3.eth.accounts.privateKeyToAccount(
      this.privateKey
    ).address;
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
      "Accept-Language": "vi-VN,vi",
    };
    this.contract_token_buy = "";
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
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  async getBalance() {
    try {
      const balance = await pubClient.getBalance({ address: this.address });
      return formatEther(balance);
    } catch (error) {
      console.error(error);
      return 0;
    }
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
  s(e, t) {
    if (!/^(-?)([0-9]*)\.?([0-9]*)$/.test(e))
      throw new i({
        value: e,
      });
    let [r, n = "0"] = e.split("."),
      s = r.startsWith("-");
    if ((s && (r = r.slice(1)), (n = n.replace(/(0+)$/, "")), 0 === t))
      1 === Math.round(Number(`.${n}`)) && (r = `${BigInt(r) + 1n}`), (n = "");
    else if (n.length > t) {
      let [e, i, s] = [n.slice(0, t - 1), n.slice(t - 1, t), n.slice(t)],
        a = Math.round(Number(`${i}.${s}`));
      (n =
        a > 9
          ? `${BigInt(e) + BigInt(1)}0`.padStart(e.length + 1, "0")
          : `${e}${a}`).length > t &&
        ((n = n.slice(1)), (r = `${BigInt(r) + 1n}`)),
        (n = n.slice(0, t));
    } else n = n.padEnd(t, "0");
    return BigInt(`${s ? "-" : ""}${r}${n}`);
  }
  async http(url, header = null, data = null, httpRetryModel = null) {
    try {
      const agent = this.proxy ? new HttpsProxyAgent(`${this.proxy}`) : null;

      const options = {
        headers: header ? { ...this.headers, header } : this.headers,
        timeout: 10000,
        httpsAgent: agent,
      };
      const axiosInstance = axios.create();
      if (!httpRetryModel) {
        httpRetryModel = new HttpRetryModel();
      }

      axiosRetry(axiosInstance, {
        retries: httpRetryModel.retries,
        retryDelay: httpRetryModel.retryDelay,
        retryCondition: httpRetryModel.retryCondition,
        onRetry: (retryCount, error, requestConfig) => {
          this.log(`Retry ${requestConfig.url}: ${retryCount}`, "error");
        },
      });
      const response = data
        ? await axiosInstance.post(url, data, options)
        : await axiosInstance.get(url, options);
      return response;
    } catch (error) {
      this.log(`HTTP error: ${error.message}`, "error");
      throw error;
    }
  }
  async callContract(contractAddress, abi, method, params, fee) {
    try {
      const contract = new this.web3.eth.Contract(abi, contractAddress);
      const data = contract.methods[method](...params).encodeABI();
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.address,
        to: contractAddress,
        data: data,
        value: this.web3.utils.toWei(fee, "ether"),
      });

      const gasPrice = await this.web3.eth.getGasPrice();
      const tx = {
        from: this.address,
        to: contractAddress,
        gas: gasEstimate,
        gasPrice: gasPrice,
        data: data,
        value: this.web3.utils.toWei(fee, "ether"),
      };
      const signedTx = await this.web3.eth.accounts.signTransaction(
        tx,
        this.private_key
      );
      const receipt = await this.web3.eth.sendSignedTransaction(
        signedTx.rawTransaction
      );
      return receipt.transactionHash;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }
  async callReadOnlyContract(contractAddress, abi, method, params) {
    try {
      const contract = new this.web3.eth.Contract(abi, contractAddress);
      const result = await contract.methods[method](...params).call();
      return result;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }

  async supply_token(contract_token) {
    try {
      const hash = await this.callReadOnlyContract(
        contract_token,
        abi_supplyToken,
        "supplyToken",
        []
      );
      return true;
    } catch (error) {
      this.log(error, "error");
    }
  }
  async sign_and_send(tx) {
    let signedTx = null;
    try {
      signedTx = await this.web3.eth.accounts.signTransaction(
        tx,
        this.private_key
      );
    } catch (error) {
      console.log(error);
    }
    const hash = await new Promise(async (resolve, recject) => {
      try {
        await this.web3.eth
          .sendSignedTransaction(signedTx.rawTransaction)
          .on("transactionHash", (hash) => {
            resolve(hash);
          })
          .on("receipt", (receipt) => {})
          .on("confirmation", (confirmation, receipt) => {})
          .on("error", (error) => {
            console.log(error);
            recject(error);
          });
        setTimeout(() => {
          recject(new Error("Time out"));
        }, 1000);
      } catch (error) {
        recject(error);
      }
    });

    return hash ?? null;
  }
  async handle_BUY(amountIn, contract_token) {
    try {
      const amount_in = this.s(`${amountIn}`, 18);
      const amount_buy = await this.callReadOnlyContract(
        contract_token,
        abi_estimateBuy,
        "estimateBuy",
        [amount_in]
      );
      const data_buy = encodeFunctionData({
        abi: abi_buyForETH,
        functionName: "buyForETH",
        args: [this.address, amount_in, amount_buy],
      });
      const hash = await this.walletClient.sendTransaction({
        to: contract_token,
        data: data_buy,
        value: amount_in,
      });
      this.log(`Swap tx: ${hash}`, "success");
      await pubClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });
      return true;
    } catch (error) {
      this.log(`Catch handle_BUY ${error.message}`, "error");
      return false;
    }
  }
  async handle_EstimateSell(amount_sell, contract_token, slippage = 3n) {
    try {
      let amount_reciver = await this.callReadOnlyContract(
        contract_token,
        abi_estimateSell,
        "estimateSell",
        [amount_sell]
      );
      amount_reciver = amount_reciver - (amount_reciver * 3n) / 100n;
      this.log(
        `Estimate Sell ${amount_sell} recive ${amount_reciver}`,
        "warning"
      );
      return amount_reciver;
    } catch (error) {
      this.log(`Cactch SELL ${error}`, "warning");
      return false;
    }
  }
  async sign_permit(contract_token, amount_sell, amount_reciver) {
    try {
      const nonce = await this.callReadOnlyContract(
        contract_token,
        abi_get_nonce,
        "nonces",
        [this.address]
      );
      const domain = {
        name: await this.callReadOnlyContract(
          contract_token,
          abi_get_name,
          "name",
          []
        ),
        version: "1",
        chainId: monadTestnet.id,
        verifyingContract: contract_token,
      };
      const deadline = BigInt(Math.round(Date.now() / 1e3) + 3600);
      const test_account = privateKeyToAccount(this.privateKey);
      const sig = await test_account.signTypedData({
        domain: domain,
        types: {
          EIP712Domain: [
            {
              name: "name",
              type: "string",
            },
            {
              name: "version",
              type: "string",
            },
            {
              name: "chainId",
              type: "uint256",
            },
            {
              name: "verifyingContract",
              type: "address",
            },
          ],
          Permit: [
            {
              name: "owner",
              type: "address",
            },
            {
              name: "spender",
              type: "address",
            },
            {
              name: "value",
              type: "uint256",
            },
            {
              name: "nonce",
              type: "uint256",
            },
            {
              name: "deadline",
              type: "uint256",
            },
          ],
        },
        primaryType: "Permit",
        message: {
          owner: this.address,
          spender: this.contract_token_buy,
          value: amount_sell.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        },
      });
      const parse_sign = parseSignature(sig);
      const v = parse_sign.v;
      const r = parse_sign.r;
      const s = parse_sign.s;
      const data_permit = encodeFunctionData({
        abi: abi_permit,
        functionName: "permit",
        args: [
          this.address,
          this.contract_token_buy,
          amount_sell,
          deadline,
          Number(v),
          r,
          s,
        ],
      });
      const data_sellForETH = encodeFunctionData({
        abi: abi_sellForETH,
        functionName: "sellForETH",
        args: [this.address, amount_sell, amount_reciver],
      });
      const param = [
        {
          target: contract_token, // ở ngoài lúc request
          allowFailure: false,
          value: 0,
          callData: data_permit,
        },
        {
          target: this.contract_token_buy,
          allowFailure: false,
          value: 0,
          callData: data_sellForETH,
        },
      ];

      const data_aggregate3Value = encodeFunctionData({
        abi: abi_aggregate3Value,
        functionName: "aggregate3Value",
        args: [param],
      });
      const hash = await this.walletClient.sendTransaction({
        to: contract_SELL,
        data: data_aggregate3Value,
      });

      this.log(`Sell tx: ${hash}`, "success");
      await pubClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  async checkToken(contract_token_input) {
    let balance_of_tokenInput = await this.callReadOnlyContract(
      contract_token_input,
      abi_balance,
      "balanceOf",
      [this.address]
    );
    return balance_of_tokenInput;
  }
  async getRandomToken() {
    try {
      const response = await axios.get(
        `https://api-testnet.xlmeme.com/api/tokens/?page=1&search=&ordering=-created&page_size=12&creator_wallet_address=&blockchain=monad_testnet`
      );
      if (response.status == 200) {
        const list_token = response.data?.results;
        const index = this.random(0, list_token.length - 1);
        const meme_buy = list_token[index];
        const info_token = await axios.get(
          `https://api-testnet.xlmeme.com/api/bonding-curves/token/${meme_buy?.uuid}/`
        );
        if (info_token.status == 200) {
          this.contract_token_buy = info_token.data?.address;
          return meme_buy;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      if (error.response) {
        this.log(`${JSON.stringify(error.response.data)}`, "error");
      }
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
      this.log(`IP: ${ip}`);
      const balance = await this.getBalance();
      if (balance > 0.1) {
        this.log(`Wallet balance ${balance}`, "success");
        const amount_buy = (0.2 * balance) / 100;
        const token = await this.getRandomToken();
        if (token) {
          this.log(`Handle Buy ${token?.name} - ${amount_buy} ETH`, "warning");
          if (await this.handle_BUY(amount_buy, this.contract_token_buy)) {
            await this.sleep(5000);
            const balance = await this.checkToken(token.contract_address);
            this.log(
              `Wallet ${this.address} balance ${balance} ${token.name}`,
              "success"
            );
            const time_hold = this.random(30, 35);
            this.log(`Hold ${time_hold}s`, "warning");
            await this.sleep(time_hold * 1000);
            await this.supply_token(this.contract_token_buy);
            let amount_reciver = await this.handle_EstimateSell(
              balance,
              this.contract_token_buy
            );
            await this.sign_permit(
              token.contract_address,
              balance,
              amount_reciver
            );
            await this.sleep(7 * 1000);
            const balance_meme = await this.checkToken(token.contract_address);
            this.log(
              `Wallet ${this.address} balance ${balance_meme}`,
              "success"
            );
          }
        } else {
          this.log(`Can't get info token skip buy...`, "warning");
        }
      } else {
        this.log(`Wallet ${this.address} insufficient balance`, "warning");
      }
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
  const web3 = new Web3(new Web3.providers.HttpProvider(RPC));
  const accounts = data.map((line, index) => {
    const proxy = proxys[index];
    const [private_key, x_data] = line.split("|");

    return new Account(index, private_key, web3, proxy);
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

class HttpRetryModel {
  constructor(
    retries = 3,
    retryDelay = () => {
      return 3000;
    },
    retryCondition = (error) => {
      error.code === "ECONNABORTED" || error.message.includes("timeout");
    }
  ) {
    this.retries = retries;
    this.retryDelay = retryDelay;
    this.retryCondition = retryCondition;
  }
}

main().catch(console.error);
