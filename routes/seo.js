const express = require('express');
const router = express.Router();
const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const Product = require('../models/product');
const News = require('../models/news');

router.get('/sitemap.xml', async (req, res) => {
    res.header('Content-Type', 'application/xml');
    res.header('Content-Encoding', 'gzip');

    try {
        const smStream = new SitemapStream({ hostname: 'https://wanzofc-shop.com' });
        const pipeline = smStream.pipe(createGzip());

        smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });
        smStream.write({ url: '/auth/login', changefreq: 'monthly', priority: 0.5 });
        smStream.write({ url: '/auth/register', changefreq: 'monthly', priority: 0.5 });
        smStream.write({ url: '/marketplace', changefreq: 'hourly', priority: 0.9 });

        const products = await Product.find({}, 'slug updatedAt');
        for (const product of products) {
            smStream.write({ 
                url: `/marketplace/product/${product.slug}`, 
                changefreq: 'daily', 
                priority: 0.8,
                lastmod: product.updatedAt
            });
        }

        const newsList = await News.find({}, 'slug updatedAt');
        for (const news of newsList) {
            smStream.write({ 
                url: `/news/${news.slug}`, 
                changefreq: 'weekly', 
                priority: 0.7,
                lastmod: news.updatedAt
            });
        }

        smStream.end();
        pipeline.pipe(res).on('error', (e) => { throw e; });
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
});

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dashboard/\nSitemap: https://api.wanzofc.site/sitemap.xml");
});

module.exports = router;