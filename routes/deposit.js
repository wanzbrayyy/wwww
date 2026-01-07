const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const User = require('../models/user');
const Deposit = require('../models/deposit');

const snap = new midtransClient.Snap({
    isProduction: true,
    serverKey: 'Mid-server-zvgGUiY7SS-HS_qhWLkqZQuL',
    clientKey: 'Mid-client-IoIOg2RqJNZgKpY6'
});

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        res.render('deposit/new', { 
            title: 'Deposit Saldo', 
            css: 'dashboard.css',
            clientKey: 'Mid-client-IoIOg2RqJNZgKpY6',
            user: user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    const { amount } = req.body;
    const user = await User.findById(req.session.user.id);

    if (amount < 10000) {
        req.flash('error_msg', 'Minimal deposit Rp 10.000');
        return res.redirect('/deposit');
    }

    try {
        const order_id = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const parameter = {
            transaction_details: {
                order_id: order_id,
                gross_amount: amount
            },
            customer_details: {
                first_name: user.fullname,
                email: user.email,
            },
            callbacks: {
                finish: "/deposit/history"
            }
        };

        const transaction = await snap.createTransaction(parameter);
        const snapToken = transaction.token;

        await new Deposit({
            user: user.id,
            order_id: order_id,
            amount: amount,
            snap_token: snapToken,
            status: 'Pending'
        }).save();

        res.render('deposit/pay', {
            title: 'Pembayaran Deposit',
            css: 'dashboard.css',
            snapToken: snapToken,
            clientKey: 'Mid-client-IoIOg2RqJNZgKpY6',
            amount: amount,
            order_id: order_id,
            user: user
        });
    } catch (err) {
        req.flash('error_msg', 'Gagal membuat transaksi');
        res.redirect('/deposit');
    }
});

router.post('/notification', async (req, res) => {
    try {
        const notificationJson = req.body;
        const statusResponse = await snap.transaction.notification(notificationJson);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        const deposit = await Deposit.findOne({ order_id: orderId });
        if (!deposit || deposit.status === 'Success') return res.status(200).send('OK');
        
        if (transactionStatus == 'capture' && fraudStatus == 'accept' || transactionStatus == 'settlement') {
            deposit.status = 'Success';
            await addBalance(deposit.user, deposit.amount);
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            deposit.status = 'Failed';
        }

        deposit.payment_type = statusResponse.payment_type;
        deposit.payment_time = new Date();
        await deposit.save();
        res.status(200).send('OK');
    } catch (err) {
        res.status(500).send('Error');
    }
});

async function addBalance(userId, amount) {
    const user = await User.findById(userId);
    user.balance += amount;
    user.totalDeposit += amount;

    if (user.totalDeposit >= 5000000) user.rank = 'Gold';
    else if (user.totalDeposit >= 1000000) user.rank = 'Silver';
    else user.rank = 'Bronze';

    if (user.referredBy) {
        const upline = await User.findOne({ referralCode: user.referredBy });
        if (upline) {
            const commission = amount * 0.05;
            upline.balance += commission;
            upline.referralEarnings += commission;
            await upline.save();
        }
    }

    await user.save();
}

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const deposits = await Deposit.find({ user: user.id }).sort({ createdAt: -1 });
        res.render('deposit/history', {
            title: 'Riwayat Deposit',
            css: 'dashboard.css',
            deposits: deposits,
            user: user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;
