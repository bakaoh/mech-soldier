const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
bot.on("polling_error", (e) => console.log(JSON.stringify(e)));
bot.on("message", (msg) => {
    console.log(JSON.stringify(msg));
});

const app = express();
app.use(express.json());

const watch = [-1001754164580];
app.post('/check', async (req, res) => {
    if (watch.includes(req.body.chat_id)) {
        console.log(req.body);
        bot.sendMessage(chatId, req.body.text, { parse_mode: "HTML" }).catch(console.log);
    }

    res.json({ error: 0 });
})

async function start(port) {
    const startMs = Date.now();
    app.listen(port);
    console.log(`Service start at port ${port} (${Date.now() - startMs}ms)`)
}

start(1984);
