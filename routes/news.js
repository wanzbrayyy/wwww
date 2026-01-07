const express = require('express');
const router = express.Router();
const News = require('../models/news');

router.get('/:slug', async (req, res) => {
    try {
        const news = await News.findOne({ slug: req.params.slug });
        if (!news) return res.redirect('/');

        res.render('news/detail', { 
            title: news.title, 
            css: 'landing.css',
            news,
            user: req.session.user || null
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

module.exports = router;