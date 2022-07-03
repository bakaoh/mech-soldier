const Crawler = require("../utils/crawler");
const { web3, ContractAddress, toBN, getFactoryName } = require('../utils/bsc');
const { Partitioner, getLastLine, getLastFile, getLastFiles } = require('../utils/io');
const { getNumber } = require('../utils/format');
const Executor = require('./executor');

const SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';
const BLOCK_FILE = 'logs/silverion.block';
const ZERO = toBN(0);

const supportQuote = [ContractAddress.WBNB]

const factory2Router = {
    [ContractAddress.PANCAKE_FACTORY]: ContractAddress.PANCAKE_ROUTER,
    [ContractAddress.BISWAP_FACTORY]: ContractAddress.BISWAP_ROUTER,
    [ContractAddress.APESWAP_FACTORY]: ContractAddress.APESWAP_ROUTER,
}

const factoryInWithFee = {
    [ContractAddress.PANCAKE_FACTORY]: 9975,
    [ContractAddress.BISWAP_FACTORY]: 9990,
    [ContractAddress.APESWAP_FACTORY]: 9970,
}

const getAmountOut = (factory, amountIn, reserveIn, reserveOut) => {
    const amountInWithFee = amountIn.muln(factoryInWithFee[factory]);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.muln(10000).add(amountInWithFee);
    return numerator.div(denominator);
}

class SyncModel {
    constructor(pairModel) {
        this.pairModel = pairModel;
        this.reserves = {};
        this.executor = new Executor(process.env.SILVERION_ADDR, process.env.SILVERION_KEY);
        this.lastExecute = {};
    }

    async runCrawler() {
        console.log(`Executor ${this.executor.address}. Balance ${await this.executor.getBnbBalance()}`);
        this.crawler = new Crawler("Sync", SYNC_TOPIC, BLOCK_FILE, async (log) => {
            const values = web3.eth.abi.decodeParameters(['uint256', 'uint256'], log.data)
            await this.onSyncLog(log.blockNumber, log.transactionIndex, log.logIndex, log.address, toBN(values[0].toString(10)), toBN(values[1].toString(10)));
        }, 200);
        await this.crawler.run();
    }

    calcPrice([reserve0, reserve1]) {
        return parseInt(reserve1.mul(toBN("100000000")).div(reserve0)) / 100000000;
    }

    async check(token0, token1, factoryA, factoryB) {
        if (factoryA == factoryB) return;
        const priceA = this.calcPrice(this.reserves[token0][token1][factoryA]);
        const priceB = this.calcPrice(this.reserves[token0][token1][factoryB]);
        if (priceA == 0 || priceB == 0) return;
        if (Math.abs(priceA - priceB) * 100 < priceA) return;
        if (supportQuote.includes(token1)) {
            const amountIn = ContractAddress.WBNB != token1 ? toBN("200000000000000000000") : toBN("1000000000000000000");
            const [factory1, factory2] = priceA < priceB ? [factoryA, factoryB] : [factoryB, factoryA];
            const amountOut1 = getAmountOut(factory1, amountIn, this.reserves[token0][token1][factory1][1], this.reserves[token0][token1][factory1][0]);
            const amountOut2 = getAmountOut(factory2, amountOut1, this.reserves[token0][token1][factory2][0], this.reserves[token0][token1][factory2][1]);
            const ok = amountOut2.gt(amountIn);
            console.log(`Found(${ok}) [${token0}] ${getNumber(amountIn.toString(10), 2)} ${getFactoryName(factory1)}=>${getNumber(amountOut2.toString(10), 2)} ${getFactoryName(factory2)}`);
            // if (ok) {
            //     if (this.lastExecute[`${token0}-${token1}`] && (Date.now() - this.lastExecute[`${token0}-${token1}`] < 5000)) return;
            //     this.lastExecute[`${token0}-${token1}`] = Date.now();
            //     const routers = [factory2Router[factory1], factory2Router[factory2]];
            //     const tx = await this.executor.execute(amountIn.toString(10), routers, [token1, token0], [token0, token1]);
            //     console.log(`Execute`, tx);
            // }
        } else if (supportQuote.includes(token0)) {
            const amountIn = ContractAddress.WBNB != token0 ? toBN("200000000000000000000") : toBN("1000000000000000000");
            const [factory1, factory2] = priceA > priceB ? [factoryA, factoryB] : [factoryB, factoryA];
            const amountOut1 = getAmountOut(factory1, amountIn, this.reserves[token0][token1][factory1][0], this.reserves[token0][token1][factory1][1]);
            const amountOut2 = getAmountOut(factory2, amountOut1, this.reserves[token0][token1][factory2][1], this.reserves[token0][token1][factory2][0]);
            const ok = amountOut2.gt(amountIn);
            console.log(`Found(${ok}) [${token1}] ${getNumber(amountIn.toString(10), 2)} ${getFactoryName(factory1)}=>${getNumber(amountOut2.toString(10), 2)} ${getFactoryName(factory2)}`);
            // if (ok) {
            //     if (this.lastExecute[`${token0}-${token1}`] && (Date.now() - this.lastExecute[`${token0}-${token1}`] < 5000)) return;
            //     this.lastExecute[`${token0}-${token1}`] = Date.now();
            //     const routers = [factory2Router[factory1], factory2Router[factory2]];
            //     const tx = await this.executor.execute(amountIn.toString(10), routers, [token0, token1], [token1, token0]);
            //     console.log(`Execute`, tx);
            // }
        }
    }

    async onSyncLog(block, txIdx, logIdx, pair, reserve0, reserve1) {
        if (reserve0 == ZERO || reserve1 == ZERO) return;
        const tokens = this.pairModel.getTokens(pair);
        if (!tokens) return;
        const { token0, token1, factory } = tokens;
        if (!this.reserves[token0]) this.reserves[token0] = {};
        if (!this.reserves[token0][token1]) this.reserves[token0][token1] = {};

        if (this.reserves[token0][token1][factory]) {
            console.log(token0, token1, this.reserves[token0][token1][factory][0].toString(10), this.reserves[token0][token1][factory][1].toString(10), reserve0.toString(10), reserve1.toString(10));
        }
        this.reserves[token0][token1][factory] = [reserve0, reserve1];
        for (let other in this.reserves[token0][token1]) {
            await this.check(token0, token1, factory, other);
        }
    }
}

module.exports = SyncModel;