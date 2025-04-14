import Web3 from "web3";
import Web3HttpProvider from "web3-providers-http";
import { HttpsProxyAgent } from "https-proxy-agent";
import { resolve } from "path";
import { error } from "console";
const RPC = "https://testnet-rpc.monad.xyz/";

export class Evm {
  constructor(private_key, proxy_url) {
    // if (proxy_url) {
    //   const customHttpProvider = new Web3HttpProvider(RPC, {
    //     providerOptions: { agent: new HttpsProxyAgent(proxy_url) },
    //   });
    //   this.web3 = new Web3(customHttpProvider);
    // } else {
    //   this.web3 = new Web3(new Web3.providers.HttpProvider(RPC));
    // }
    this.web3 = new Web3(new Web3.providers.HttpProvider(RPC));
    this.private_key = private_key;
    this.address =
      this.web3.eth.accounts.privateKeyToAccount(private_key).address;
  }
  async getBalance() {
    try {
      const balance = await this.web3.eth.getBalance(this.address);
      return this.web3.utils.fromWei(balance, "ether");
    } catch (error) {
      console.error(error);
      return 0;
    }
  }
  async callContract(contractAddress, abi, method, params, fee) {
    try {
      const contract = new this.web3.eth.Contract(abi, contractAddress);
      const data = contract.methods[method](...params).encodeABI();
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasEstimate = await this.web3.eth.estimateGas({
        from: this.address,
        to: contractAddress,
        data: data,
        value: this.web3.utils.toWei(fee, "ether"),
      });

      const tx = {
        from: this.address,
        to: contractAddress,
        gas: gasEstimate,
        gasPrice: gasPrice,
        data: data,
        value: this.web3.utils.toWei(fee, "ether"),
      };
      return tx;
    } catch (error) {
      console.error(error.message);
      return false;
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
  async sign_message(message) {
    try {
      const signature = await this.web3.eth.accounts.sign(
        message,
        this.private_key
      );
      return signature;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }
}
