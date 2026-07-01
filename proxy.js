const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Берём ключ из переменной окружения
const NOVITA_API_KEY = process.env.NOVITA_API_KEY || '';

app.post('/api/ocr', async (req, res) => {
  try {
    if (!NOVITA_API_KEY) {
      return res.status(500).json({ error: 'NOVITA_API_KEY не установлен в переменных окружения' });
    }

    const response = await axios.post(
      'https://api.novita.ai/openai/chat/completions',
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${NOVITA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || { message: err.message }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));
