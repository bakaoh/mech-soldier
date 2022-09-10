const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post('/check', async (req, res) => {
    console.log(req.body)
    res.json({ error: 0 });
})

async function start(port) {
    const startMs = Date.now();
    app.listen(port);
    console.log(`Service start at port ${port} (${Date.now() - startMs}ms)`)
}

start(1984);
