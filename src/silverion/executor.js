const Web3 = require("web3");
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common');
const Silverion = require('../abi/Silverion.json');

const common = Common.default.forCustomChain('mainnet', {
    name: 'bnb',
    networkId: 56,
    chainId: 56,
}, 'istanbul');

const web3 = new Web3("https://bsc-dataseed.binance.org");
web3.eth.handleRevert = true;

const SilverionContract = new web3.eth.Contract(Silverion.abi, Silverion.address);

class Executor {
    constructor(address, key) {
        this.address = web3.utils.toChecksumAddress(address);
        this.key = key;
        this.running = false;
    }

    async execute(amountIn, routers, path1, path2) {
        if (this.running) return "Busy";
        this.running = true;
        try {
            const data = SilverionContract.methods.holyray(
                web3.utils.toHex(amountIn),
                routers.map(a => web3.utils.toChecksumAddress(a)),
                path1.map(a => web3.utils.toChecksumAddress(a)),
                path2.map(a => web3.utils.toChecksumAddress(a))
            ).encodeABI();
            return this.sendTx(Silverion.address, data);
        } catch (err) {
            return `Fail ${err.reason ? err.reason : err.toString()}`;
        } finally {
            this.running = false;
        }
    }

    async sendBnb(toAddress, amount) {
        return this.sendTx(toAddress, undefined, web3.utils.toHex(amount));
    }

    getBnbBalance() {
        return web3.eth.getBalance(this.address);
    }

    async sendTx(to, data = undefined, value = '0x') {
        const txCount = await web3.eth.getTransactionCount(this.address);
        var txObject = {};
        txObject.nonce = web3.utils.toHex(txCount);
        txObject.gasLimit = web3.utils.toHex(data ? 1000000 : 21000);
        txObject.gasPrice = web3.utils.toHex(web3.utils.toWei("5", "gwei"));
        txObject.to = web3.utils.toChecksumAddress(to);
        txObject.value = value;
        if (data) txObject.data = data;

        //Sign transaction before sending
        var tx = new Tx(txObject, { common });
        var privateKey = Buffer.from(this.key, 'hex')
        tx.sign(privateKey);
        var serializedTx = tx.serialize();
        return web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .then(tx => tx.transactionHash);
    }
}

module.exports = Executor;
