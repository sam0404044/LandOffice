const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config(); // 讀取 .env

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// POST /form-submit - 接收 userId 和表單資料，並推播 LINE 訊息
app.post("/form-submit", async (req, res) => {
  const { userId, formData } = req.body;

  if (!userId || !formData) {
    return res.status(400).json({ error: "缺少 userId 或 formData" });
  }

  // 把表單資料格式化成文字訊息
  const message = `✅ 感謝您填寫表單！\n\n您的資料如下：\n${Object.entries(formData)
    .map(([key, val]) => `${key}：${val}`)
    .join("\n")}`;

  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: userId,
        messages: [{ type: "text", text: message }]
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );

    res.json({ status: "訊息已送出給使用者" });
  } catch (err) {
    console.error("LINE 傳訊失敗：", err.response?.data || err.message);
    res.status(500).json({ error: "LINE 傳訊失敗" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
