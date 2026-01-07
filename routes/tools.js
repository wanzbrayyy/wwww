const express = require('express');
const router = express.Router();
const { tiktokdl, igStalk, igDownload } = require('../utils/downloader');

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/tiktok', ensureAuthenticated, (req, res) => {
    res.render('tools/tiktok', { 
        title: 'TikTok Downloader', css: 'dashboard.css', result: null, error: null 
    });
});

router.post('/tiktok', ensureAuthenticated, async (req, res) => {
    try {
        const data = await tiktokdl(req.body.url);
        res.render('tools/tiktok', { 
            title: 'TikTok Downloader', css: 'dashboard.css', result: data, error: null 
        });
    } catch (e) {
        res.render('tools/tiktok', { 
            title: 'TikTok Downloader', css: 'dashboard.css', result: null, error: e.message 
        });
    }
});

router.get('/ig-stalk', ensureAuthenticated, (req, res) => {
    res.render('tools/ig-stalk', { 
        title: 'Instagram Tools', css: 'dashboard.css', result: null, error: null, type: null
    });
});

router.post('/ig-stalk', ensureAuthenticated, async (req, res) => {
    const { input } = req.body;
    if (!input) return res.redirect('/tools/ig-stalk');

    try {
        const isUrl = input.includes('instagram.com');
        
        if (isUrl) {
            const data = await igDownload(input);
            res.render('tools/ig-stalk', { 
                title: 'Instagram Downloader', 
                css: 'dashboard.css', 
                result: data, 
                error: null, 
                type: 'download' 
            });
        } else {
            const data = await igStalk(input);
            res.render('tools/ig-stalk', { 
                title: 'Instagram Stalker', 
                css: 'dashboard.css', 
                result: data, 
                error: null, 
                type: 'stalk' 
            });
        }
    } catch (e) {
        res.render('tools/ig-stalk', { 
            title: 'Instagram Tools', 
            css: 'dashboard.css', 
            result: null, 
            error: e.message, 
            type: null 
        });
    }
});

module.exports = router;