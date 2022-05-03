import DBO from "dbo";
import pkg from "sequelize";
import { ClientException, ServerException } from "p_exception";
import { Wallet } from "../models/index.js";
import CryptoJS from "crypto-js";
import RandomString from "randomstring";
import { ChainBuss } from "./index.js";

const { Op } = pkg;
const { dbo, AbstractBusiness } = DBO;
class WalletBusiness extends AbstractBusiness {
  getModel() {
    return {
      model: dbo.Wallet,
    };
  }

  async getInfo(publicKey) {
    try {
        const { model } = this.getModel();
        const user = await model.findOne({
            where: {
                [Op.and]: {
                    [Wallet.PublicKey]: publicKey
                }
            }
        }).dataValues;
        return user;
    } catch (e) {
      return new ServerException(e.message);
    }
  }

  async create(name, initAmount = 0) {
    try {
        const { model } = this.getModel();
        const publicKey = this.encrypt((new Date).toString() + name + this.random());
        const genPassword = this.encrypt((new Date).toString() + name + this.random());
        const privateKey = this.encrypt(genPassword);
        const newWallet = await model.create({
            [Wallet.Name]: name,
            [Wallet.PublicKey]: publicKey,
            [Wallet.PrivateKey]: privateKey
        });

        if (newWallet[Wallet.ID] === null || newWallet[Wallet.ID] === undefined) {
            throw new ServerException("Can't create wallet");
        }

        await ChainBuss.executeTransaction(process.env.PUBLIC_KEY_WALLET, newWallet[Wallet.PrivateKey], initAmount);
        return {
            name: name,
            publicKey: publicKey,
            privateKey: genPassword
        }
    } catch (e) {
      return new ServerException(e.message);
    }
  }

  async connect(publicKey, privateKey) {
    try {
        const { model } = this.getModel();
        const user = await model.findOne({
            where: {
                [Op.and]: {
                    [Wallet.PublicKey]: publicKey
                }
            }
        }).dataValues;

        if (user?.ID === undefined) {
            throw new ServerException("User isn't exist");
        }

        if (privateKey !== this.decrypt(user.PrivateKey)) {
            throw new ServerException("Private key incorrect");
        }

        return user;
    } catch (e) {
      return new ServerException(e.message);
    }
  }

  encrypt(message) {
    let cipherText = CryptoJS.AES.encrypt(message, process.env.SECRET_KEY_IV).toString();
    return cipherText;
  }

  decrypt(cipherText) {
    let bytes  = CryptoJS.AES.decrypt(cipherText, process.env.SECRET_KEY_IV);
    let originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  }

  random() {
      return RandomString.generate();
  }
}

export default new WalletBusiness();
