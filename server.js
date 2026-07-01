// server.js
const express = require('express');
const cors = require('cors');
const { translate } = require('@vitalets/google-translate-api');

const app = express();

// Настройка CORS — разрешаем запросы откуда угодно
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Парсим JSON-тело запроса
app.use(express.json({ limit: '50mb' }));

// Обработка preflight запросов
app.options('*', cors());

// Корневой эндпоинт для проверки работоспособности
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Translate Proxy Server is running!',
    version: '1.0.0'
  });
});

// Основной эндпоинт перевода
app.post('/translate', async (req, res) => {
  const startTime = Date.now();

  try {
    const { text, to = 'ru', from = 'auto' } = req.body;

    // Валидация входящих данных
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "text" field'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: 'Text too long. Maximum 5000 characters allowed.'
      });
    }

    console.log(`📝 Перевод запрошен: "${text.slice(0, 50)}..." (${text.length} символов)`);
    console.log(`🌍 Языки: ${from} → ${to}`);

    // Выполняем перевод
    const result = await translate(text, {
      to,
      from,
      // Опция для улучшения стабильности
      client: 'gtx',
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Перевод выполнен за ${duration}мс`);

    res.json({
      success: true,
      translatedText: result.text,
      from: result.from,
      to: to,
      duration: `${duration}ms`,
      originalLength: text.length,
    });

  } catch (error) {
    console.error('❌ Ошибка при переводе:', error.message);

    // Пробуем повторить с fallback-настройками
    try {
      console.log('🔄 Повторная попытка с fallback...');
      const { text, to = 'ru' } = req.body;

      const fallbackResult = await translate(text, {
        to,
        client: 'gtx',
        // Используем другой endpoint
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
      console.error('❌ Fallback тоже не удался:', fallbackError.message);
      res.status(500).json({
        error: 'Translation failed',
        details: error.message,
      });
    }
  }
});

// Эндпоинт для пакетного перевода (несколько строк)
app.post('/translate-batch', async (req, res) => {
  try {
    const { texts, to = 'ru', from = 'auto' } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid "texts" array'
      });
    }

    console.log(`📦 Пакетный перевод: ${texts.length} строк`);

    // Переводим последовательно с задержкой
    const results = [];
    for (const text of texts) {
      if (text && text.length > 0) {
        try {
          const result = await translate(text, { to, from });
          results.push(result.text);
        } catch (e) {
          results.push(text); // если не перевелось — оставляем оригинал
        }
        // Задержка 200мс между запросами
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

// Эндпоинт для определения языка
app.post('/detect-language', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "text" field'
      });
    }

    const result = await translate(text, { to: 'en' });

    res.json({
      success: true,
      detectedLanguage: result.from,
      confidence: 'high',
    });

  } catch (error) {
    console.error('❌ Ошибка определения языка:', error);
    res.status(500).json({
      error: 'Language detection failed',
      details: error.message,
    });
  }
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
║  📡 Доступен по: http://localhost:${PORT} ║
╚═══════════════════════════════════════╝
  `);
});
