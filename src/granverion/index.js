const { Spot } = require('@binance/connector')

const client = new Spot('', '', {
    baseURL: 'https://api3.binance.com'
})

const OHLC = async (symbol, interval) => {
    const res = await client.klines(symbol, interval, { limit: 500 })
    return res.data.map(e => ({
        ts: e[0],
        open: parseFloat(e[1]),
        high: parseFloat(e[2]),
        low: parseFloat(e[3]),
        close: parseFloat(e[4])
    }));
}

const HeikinAshi = (ohlc) => ohlc.map((e, i) => {
    const close = (e.open + e.high + e.low + e.close) / 4;
    const open = i == 0 ? e.open : ((ohlc[i - 1].open + ohlc[i - 1].close) / 2);
    return {
        ts: e.ts,
        close,
        open,
        high: Math.max(e.high, open, close),
        low: Math.min(e.low, open, close)
    }
});

const TrueRange = (cur, prev) => Math.max(
    Math.abs(cur.high - prev.close),
    Math.abs(cur.low - prev.close),
    Math.abs(cur.high - cur.low),
);

// Simple CE with length=1
const ChandelierExit = (series, mult, ohlc) => {
    let last = {};
    let m = 0;
    let bnb = 0;
    let c = 0;
    let dir = 1
    for (let i = 0; i < series.length; i++) {
        const cur = series[i];
        const prev = i == 0 ? cur : series[i - 1];

        const atr = mult * TrueRange(cur, prev);

        let longStop = cur.close - atr;
        const longStopPrev = last.longStop ? last.longStop : longStop;
        longStop = prev.close > longStopPrev ? Math.max(longStop, longStopPrev) : longStop;

        let shortStop = cur.close + atr;
        const shortStopPrev = last.shortStop ? last.shortStop : shortStop;
        shortStop = prev.close < shortStopPrev ? Math.min(shortStop, shortStopPrev) : shortStop;

        dir = cur.close > shortStopPrev ? 1 : cur.close < longStopPrev ? -1 : dir;
        const buySignal = dir == 1 && last.dir == -1;
        const sellSignal = dir == -1 && last.dir == 1;

        if (buySignal) {
            c++;
            bnb += 1;
            m -= ohlc[i].close;
            // console.log(`Buy at ${cur.close} (${new Date(cur.ts)})`)
        }
        if (sellSignal) {
            c++;
            bnb -= 1;
            m += ohlc[i].close;
            // console.log(`Sell at ${cur.close} (${new Date(cur.ts)})`)
        }

        last = { longStop, shortStop, dir };
    }

    console.log(c, m, bnb)
};

async function run() {
    const ohlc = await OHLC('BTCUSDT', '1h');
    const ha = HeikinAshi(ohlc);
    ChandelierExit(ha, 1, ohlc);
    ChandelierExit(ha, 1.5, ohlc);
    ChandelierExit(ha, 2, ohlc);

    ChandelierExit(ha, 1, ha);
    ChandelierExit(ha, 1.5, ha);
    ChandelierExit(ha, 2, ha);

    ChandelierExit(ohlc, 1, ohlc);
    ChandelierExit(ohlc, 1.5, ohlc);
    ChandelierExit(ohlc, 2, ohlc);
}

run()