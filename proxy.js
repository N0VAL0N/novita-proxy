// proxy.js
const express = require('express');
const cors = require('cors');
const { translate } = require('@vitalets/google-translate-api');

const app = express();

// Настройка CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Парсим JSON
app.use(express.json({ limit: '50mb' }));

// Обработка preflight
app.options('*', cors());

// Проверка работоспособности
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Translate Proxy Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Основной эндпоинт перевода
app.post('/translate', async (req, res) => {
  try {
    const { text, to = 'ru', from = 'auto' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "text" field'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: 'Text too long. Maximum 5000 characters.'
      });
    }

    console.log(`📝 Перевод: "${text.slice(0, 50)}..." (${text.length} символов)`);

    const result = await translate(text, {
      to,
      from,
      client: 'gtx',
    });

    console.log(`✅ Перевод выполнен`);

    res.json({
      success: true,
      translatedText: result.text,
      from: result.from,
      to: to,
    });

  } catch (error) {
    console.error('❌ Ошибка:', error.message);

    // Fallback попытка
    try {
      const { text, to = 'ru' } = req.body;
      const fallbackResult = await translate(text, {
        to,
        client: 'gtx',
        host: 'translate.google.com',
      });

      res.json({
        success: true,
        translatedText: fallbackResult.text,
        from: fallbackResult.from,
        to: to,
        fallback: true,
      });
    } catch (fallbackError) {
      console.error('❌ Fallback тоже не удался');
      res.status(500).json({
        error: 'Translation failed',
        details: error.message,
      });
    }
  }
});

// Пакетный перевод
app.post('/translate-batch', async (req, res) => {
  try {
    const { texts, to = 'ru', from = 'auto' } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid "texts" array'
      });
    }

    console.log(`📦 Пакетный перевод: ${texts.length} строк`);

    const results = [];
    for (const text of texts) {
      if (text && text.length > 0) {
        try {
          const result = await translate(text, { to, from, client: 'gtx' });
          results.push(result.text);
        } catch (e) {
          results.push(text);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        results.push('');
      }
    }

    res.json({
      success: true,
      translations: results,
      count: results.length,
    });

  } catch (error) {
    console.error('❌ Ошибка пакетного перевода:', error);
    res.status(500).json({
      error: 'Batch translation failed',
      details: error.message,
    });
  }
});

// Определение языка
app.post('/detect-language', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "text" field'
      });
    }

    const result = await translate(text, { to: 'en', client: 'gtx' });

    res.json({
      success: true,
      detectedLanguage: result.from,
    });

  } catch (error) {
    console.error('❌ Ошибка определения языка:', error);
    res.status(500).json({
      error: 'Language detection failed',
      details: error.message,
    });
  }
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🌐 Translate Proxy Server           ║
║  🚀 Запущен на порту ${PORT}          ║
╚═══════════════════════════════════════╝
  `);
});
