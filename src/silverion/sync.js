const Crawler = require("../utils/crawler");
const { web3, ContractAddress, isUSD, toBN } = require('../utils/bsc');
const { Partitioner, getLastLine, getLastFile, getLastFiles } = require('../utils/io');
const { getNumber } = require('../utils/format');

const SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';
const BLOCK_FILE = 'logs/silverion.block';
const ZERO = toBN(0);

const getAmountOut = (amountIn, reserveIn, reserveOut) => {
    const amountInWithFee = amountIn.muln(9975);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.muln(10000).add(amountInWithFee);
    return numerator.div(denominator);
}

class SyncModel {
    constructor(pairModel) {
        this.pairModel = pairModel;
        this.reserves = {};
    }

    async runCrawler() {
        this.crawler = new Crawler("Sync", SYNC_TOPIC, BLOCK_FILE, async (log) => {
            const values = web3.eth.abi.decodeParameters(['uint256', 'uint256'], log.data)
            await this.onSyncLog(log.blockNumber, log.transactionIndex, log.logIndex, log.address, values[0].toString(10), values[1].toString(10));
        }, 200);
        await this.crawler.run();
    }

    calcPrice([reserve0, reserve1]) {
        if (reserve0 == ZERO || reserve1 == ZERO) return 0;
        return parseInt(reserve1.mul(toBN("100000000")).div(reserve0)) / 100000000;
    }

    async onSyncLog(block, txIdx, logIdx, pair, reserve0, reserve1) {
        const tokens = this.pairModel.getTokens(pair);
        if (!tokens) return;
        const { token0, token1, factory } = tokens;
        if (!this.reserves[token0]) this.reserves[token0] = {};
        if (!this.reserves[token0][token1]) this.reserves[token0][token1] = {};
        this.reserves[token0][token1][factory] = this.calcPrice([toBN(reserve0), toBN(reserve1)]);
        for (let f in this.reserves[token0][token1]) {
            if (f != factory) {
                const p1 = this.reserves[token0][token1][f];
                const p2 = this.reserves[token0][token1][factory];
                if (Math.abs(p1 - p2) * 100 > p2) console.log(token0, token1, p1, p2);
            }
        }
    }
}

module.exports = SyncModel;