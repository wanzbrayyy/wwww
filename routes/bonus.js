const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Voucher = require('../models/voucher');

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.post('/daily', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const now = new Date();
        
        if (user.lastDailyClaim && (now - user.lastDailyClaim) < 24 * 60 * 60 * 1000) {
            req.flash('error_msg', 'Anda sudah klaim bonus hari ini.');
            return res.redirect('/dashboard');
        }

        const bonus = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
        user.balance += bonus;
        user.lastDailyClaim = now;
        await user.save();
        
        req.session.user.balance = user.balance;
        req.flash('success_msg', `Berhasil klaim bonus harian Rp ${bonus}`);
        res.redirect('/dashboard');
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/redeem', ensureAuthenticated, async (req, res) => {
    const { code } = req.body;
    try {
        const voucher = await Voucher.findOne({ code, type: 'balance' });
        if (!voucher || voucher.quota <= 0 || voucher.expiresAt < new Date()) {
            req.flash('error_msg', 'Voucher tidak valid atau habis');
            return res.redirect('/deposit');
        }

        if (voucher.usedBy.includes(req.session.user.id)) {
            req.flash('error_msg', 'Anda sudah menggunakan voucher ini');
            return res.redirect('/deposit');
        }

        const user = await User.findById(req.session.user.id);
        user.balance += voucher.value;
        await user.save();

        voucher.quota -= 1;
        voucher.usedBy.push(user._id);
        await voucher.save();

        req.flash('success_msg', `Voucher berhasil! Saldo +Rp ${voucher.value}`);
        res.redirect('/deposit');
    } catch (err) {
        res.redirect('/deposit');
    }
});

router.get('/leaderboard', ensureAuthenticated, async (req, res) => {
    try {
        const topUsers = await User.find()
            .select('username rank balance totalDeposit profile_pic')
            .sort({ balance: -1 })
            .limit(20);
        
        res.render('bonus/leaderboard', {
            title: 'Top Leaderboard',
            css: 'dashboard.css',
            user: req.session.user,
            topUsers
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;