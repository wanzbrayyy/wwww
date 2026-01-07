const express = require('express');
const router = express.Router();
const User = require('../models/user');
const SmmOrder = require('../models/smmOrder');
const PpobOrder = require('../models/ppobOrder');
const News = require('../models/news');

const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Silakan login terlebih dahulu');
  res.redirect('/auth/login');
};

router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('index', { title: 'Home - wanzofc shop', css: 'landing.css' });
});

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    if (!user) {
        req.session.destroy();
        return res.redirect('/auth/login');
    }

    // Hitung waktu sisa klaim bonus (dalam milidetik)
    let timeRemaining = 0;
    if (user.lastDailyClaim) {
        const nextClaim = new Date(user.lastDailyClaim).getTime() + (24 * 60 * 60 * 1000);
        const now = Date.now();
        if (nextClaim > now) {
            timeRemaining = nextClaim - now;
        }
    }

    // Ambil Top 5 Leaderboard (Berdasarkan Saldo/Total Deposit)
    const leaderboard = await User.find()
        .select('username rank balance totalDeposit profile_pic')
        .sort({ balance: -1 })
        .limit(5);

    const smmCount = await SmmOrder.countDocuments({ user: user._id });
    const ppobCount = await PpobOrder.countDocuments({ user: user._id });
    const newsList = await News.find().sort({ createdAt: -1 }).limit(5);

    res.render('dashboard/index', { 
      title: 'Dashboard - wanzofc shop', 
      css: 'dashboard.css',
      user: user,
      stats: { smmCount, ppobCount },
      newsList: newsList,
      leaderboard: leaderboard,
      bonusTimeRemaining: timeRemaining 
    });
  } catch (err) {
    console.error(err);
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
            user: user,
            newsList
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;