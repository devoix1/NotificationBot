const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = '2138500456:AAGnGCZTmcPq-ellie7OXPRBI_Va1qXEpNQ'; // Замените на ваш токен
const CHAT_ID = '-879099335'; // Замените на ваш chat_id

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userRequisites = {};
const emailLastSent = new Map(); 
const clients = [];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use((req, res, next) => {
  //const allowedOrigins = ['http://localhost:5173']; // Массив разрешенных доменов
  const allowedOrigins = ['https://dmdsoft.site']; // Массив разрешенных доменов
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Content-Type', "application/json")
  
  next();
});

app.post('/submit', (req, res) => {
  const { email, paymentMethod, plan, id } = req.body;

  // Проверяем время последней отправки по email
  const currentTime = Date.now();
  if (emailLastSent.has(email)) {
    const lastSentTime = emailLastSent.get(email);
    const timeDifference = currentTime - lastSentTime;
    if (timeDifference < 5 * 60 * 1000) { // Ограничиваем отправку раз в 5 минут
      return res.status(429).json({ error: 'Too many requests' });
    }
  }

  // Если время ожидания прошло, обновляем время последней отправки
  emailLastSent.set(email, currentTime);

  const message = `
Email: ${email}
Payment method: ${paymentMethod}
Choose plan: ${plan}
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Отправить реквизиты',
            callback_data: `send_requisites_${id}`,
          },
        ],
      ],
    },
  };

  bot.sendMessage(CHAT_ID, message, keyboard);
  res.json({ userId: id });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const userId = req.query.userId;
  clients.push({ userId, res });

  req.on('close', () => {
    const index = clients.findIndex(client => client.userId === userId);
    if (index !== -1) {
      clients.splice(index, 1);
      delete userRequisites[userId];
    }
  });
});

bot.on('callback_query', (query) => {
  if (query.data.indexOf('send_requisites') !== -1) {
    const regex = /send_requisites_(\d+)/;
    const match = query.data.match(regex);
    const idNumber = match[1];

    const userId = query.message.chat.id;
    bot.sendMessage(userId, 'Введите реквизиты:');
    bot.once('message', (msg) => {
      const data = msg.text;
      const responseData = JSON.stringify({ update: 1, data });
      userRequisites[idNumber] = data;
      
      const client = clients.find(client => client.userId === idNumber);
      if (client) {
        client.res.write(`data: ${responseData}\n\n`);
      }
      
      bot.sendMessage(userId, `Реквизиты успешно сохранены.`);
    });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

