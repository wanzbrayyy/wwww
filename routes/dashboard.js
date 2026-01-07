const express = require('express');
const router = express.Router();
const User = require('../models/user');
const SmmOrder = require('../models/smmOrder');
const PpobOrder = require('../models/ppobOrder');
const News = require('../models/news');

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    res.redirect('/auth/login');
};

router.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    
    let variant = req.cookies?.lp_variant;
    if (!variant) {
        variant = Math.random() < 0.5 ? 'A' : 'B';
        res.cookie('lp_variant', variant, { maxAge: 900000, httpOnly: true });
    }

    res.render('index', { 
        title: 'Home - Wanzofc Shop', 
        css: 'landing.css',
        variant
    });
});

router.get('/tutorial', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        res.render('dashboard/tutorial', { 
            title: 'Tutorial & Panduan', 
            css: 'dashboard.css', 
            user: user 
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);

        if (!user) {
            req.session.destroy();
            return res.redirect('/auth/login');
        }

        let timeRemaining = 0;
        if (user.lastDailyClaim) {
            const nextClaim = new Date(user.lastDailyClaim).getTime() + (24 * 60 * 60 * 1000);
            const now = Date.now();
            if (nextClaim > now) {
                timeRemaining = nextClaim - now;
            }
        }

        const leaderboard = await User.find()
            .select('username rank balance totalDeposit profile_pic')
            .sort({ balance: -1 })
            .limit(5);

        const smmCount = await SmmOrder.countDocuments({ user: user._id });
        const ppobCount = await PpobOrder.countDocuments({ user: user._id });
        const newsList = await News.find().sort({ createdAt: -1 }).limit(5);

        res.render('dashboard/index', { 
            title: 'Dashboard - Wanzofc Shop', 
            css: 'dashboard.css',
            user,
            stats: { smmCount, ppobCount },
            newsList,
            leaderboard,
            bonusTimeRemaining: timeRemaining 
        });
    } catch (err) {
        res.redirect('/');
    }
});

router.get('/information', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const newsList = await News.find().sort({ createdAt: -1 });
        
        res.render('dashboard/information', {
            title: 'Pusat Informasi',
            css: 'dashboard.css',
            user,
            newsList
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.get('/affiliate', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        res.render('dashboard/affiliate', {
            title: 'Program Afiliasi',
            css: 'dashboard.css',
            user,
            referralLink: `https://api.wanzofc.site/auth/register?referral=${user.referralCode}`
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;