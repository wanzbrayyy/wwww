const express = require('express');
const router = express.Router();
const { translateText } = require('../utils/translator');

router.post('/translate', async (req, res) => {
    const { text, targetLang } = req.body;
    
    if (!text || !targetLang) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    if (Array.isArray(text)) {
        try {
            const promises = text.map(t => translateText(t, targetLang));
            const results = await Promise.all(promises);
            return res.json({ translatedText: results });
        } catch (err) {
            return res.status(500).json({ error: 'Translation failed' });
        }
    }

    try {
        const result = await translateText(text, targetLang);
        res.json({ translatedText: result });
    } catch (err) {
        res.status(500).json({ error: 'Translation failed' });
    }
});

module.exports = router;