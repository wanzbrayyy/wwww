const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const axios = require('axios');
const User = require('../models/user');
const Deposit = require('../models/deposit');

const MIDTRANS_SERVER_KEY = 'Mid-server-zvgGUiY7SS-HS_qhWLkqZQuL';
const MIDTRANS_CLIENT_KEY = 'Mid-client-IoIOg2RqJNZgKpY6';
const RUMAHOTP_KEY = 'otp_IlsebAaegBpqltRs';
const RUMAHOTP_API = 'https://www.rumahotp.com/api';

const snap = new midtransClient.Snap({
    isProduction: true,
    serverKey: MIDTRANS_SERVER_KEY,
    clientKey: MIDTRANS_CLIENT_KEY
});

const refreshUser = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const userId = req.session.user.id || req.session.user._id;
            const freshUser = await User.findById(userId);
            if (freshUser) {
                req.session.user = freshUser;
                res.locals.user = freshUser;
            } else {
                req.session.user = null;
                res.locals.user = null;
            }
        } catch (err) {
            res.locals.user = null;
        }
    } else {
        res.locals.user = null;
    }
    next();
};

router.use(refreshUser);

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        res.render('deposit/new', { 
            title: 'Deposit Saldo', 
            css: 'dashboard.css',
            user: req.session.user,
            clientKey: MIDTRANS_CLIENT_KEY
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    const { amount } = req.body;
    const user = await User.findById(req.session.user.id);
    const nominal = parseInt(amount);

    if (nominal < 2000) {
        req.flash('error_msg', 'Minimal deposit Rp 2.000');
        return res.redirect('/deposit');
    }

    try {
        if (nominal < 10000) {
            const fee = 1000;
            const amountWithFee = nominal + fee;

            const response = await axios.get(`${RUMAHOTP_API}/v1/deposit/create?amount=${amountWithFee}&payment_id=qris`, {
                headers: { 'x-apikey': RUMAHOTP_KEY, 'Accept': 'application/json' }
            });

            if (response.data.success) {
                const data = response.data.data;
                
                await new Deposit({
                    user: user._id,
                    order_id: data.id,
                    amount: nominal,
                    status: 'Pending',
                    payment_type: 'qris_rumahotp',
                    qr_code: data.qr,
                    expired_at: new Date(data.expired)
                }).save();

                return res.render('deposit/pay_rumahotp', {
                    title: 'Pembayaran QRIS',
                    css: 'dashboard.css',
                    amount: data.currency.total,
                    order_id: data.id,
                    qr_image: data.qr,
                    expired: new Date(data.expired),
                    user: user
                });
            } else {
                throw new Error('Gagal membuat QRIS RumahOTP');
            }

        } else {
            const order_id = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const parameter = {
                transaction_details: {
                    order_id: order_id,
                    gross_amount: nominal
                },
                customer_details: {
                    first_name: user.username,
                    email: user.email,
                    phone: user.whatsapp
                },
                callbacks: {
                    finish: `${process.env.BASE_URL || 'https://wanzofc.site'}/deposit/history`
                }
            };

            const transaction = await snap.createTransaction(parameter);
            
            await new Deposit({
                user: user._id,
                order_id: order_id,
                amount: nominal,
                snap_token: transaction.token,
                status: 'Pending',
                payment_type: 'midtrans'
            }).save();

            return res.render('deposit/pay', {
                title: 'Pembayaran Deposit',
                css: 'dashboard.css',
                snapToken: transaction.token,
                clientKey: MIDTRANS_CLIENT_KEY,
                amount: nominal,
                order_id: order_id,
                user: user
            });
        }

    } catch (err) {
        req.flash('error_msg', 'Gagal membuat transaksi: ' + err.message);
        res.redirect('/deposit');
    }
});

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const deposits = await Deposit.find({ user: req.session.user.id }).sort({ createdAt: -1 });
        res.render('deposit/history', {
            title: 'Riwayat Deposit',
            css: 'dashboard.css',
            deposits: deposits,
            user: req.session.user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/check-status/:id', ensureAuthenticated, async (req, res) => {
    try {
        const deposit = await Deposit.findOne({ order_id: req.params.id, user: req.session.user.id });
        if (!deposit) return res.json({ success: false });

        const response = await axios.get(`${RUMAHOTP_API}/v2/deposit/get_status?deposit_id=${deposit.order_id}`, {
            headers: { 'x-apikey': RUMAHOTP_KEY, 'Accept': 'application/json' }
        });

        if (response.data.success) {
            const status = response.data.data.status;
            if (status === 'success' && deposit.status !== 'Success') {
                deposit.status = 'Success';
                deposit.payment_time = new Date();
                await deposit.save();
                await processSuccessDeposit(deposit.user, deposit.amount);
                return res.json({ success: true, status: 'Success' });
            } else if (status === 'cancel' || status === 'expired') {
                deposit.status = 'Failed';
                await deposit.save();
                return res.json({ success: true, status: 'Failed' });
            }
        }
        res.json({ success: true, status: deposit.status });
    } catch (err) {
        res.json({ success: false });
    }
});

router.post('/cancel/:id', ensureAuthenticated, async (req, res) => {
    try {
        const deposit = await Deposit.findOne({ order_id: req.params.id, user: req.session.user.id });
        if (!deposit || deposit.status !== 'Pending') return res.json({ success: false });

        const response = await axios.get(`${RUMAHOTP_API}/v1/deposit/cancel?deposit_id=${deposit.order_id}`, {
            headers: { 'x-apikey': RUMAHOTP_KEY, 'Accept': 'application/json' }
        });

        if (response.data.success) {
            deposit.status = 'Failed';
            await deposit.save();
            return res.json({ success: true });
        }
        res.json({ success: false });
    } catch (err) {
        res.json({ success: false });
    }
});

router.post('/notification', async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        const deposit = await Deposit.findOne({ order_id: orderId });
        if (!deposit) return res.status(404).send('Deposit not found');
        if (deposit.status === 'Success') return res.status(200).send('Already processed');

        let newStatus = 'Pending';

        if (transactionStatus == 'capture') {
            if (fraudStatus == 'challenge') newStatus = 'Pending';
            else if (fraudStatus == 'accept') newStatus = 'Success';
        } else if (transactionStatus == 'settlement') {
            newStatus = 'Success';
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            newStatus = 'Failed';
        } else if (transactionStatus == 'pending') {
            newStatus = 'Pending';
        }

        deposit.status = newStatus;
        deposit.payment_type = statusResponse.payment_type;
        deposit.payment_time = new Date();
        await deposit.save();

        if (newStatus === 'Success') {
            await processSuccessDeposit(deposit.user, deposit.amount);
        }

        res.status(200).send('OK');
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

async function processSuccessDeposit(userId, amount) {
    const user = await User.findById(userId);
    if (!user) return;

    user.balance += amount;
    user.totalDeposit = (user.totalDeposit || 0) + amount;

    if (user.totalDeposit >= 5000000) user.rank = 'Gold';
    else if (user.totalDeposit >= 1000000) user.rank = 'Silver';
    
    if (user.referredBy) {
        const upline = await User.findOne({ referralCode: user.referredBy });
        if (upline) {
            const commission = amount * 0.05; 
            upline.balance += commission;
            upline.referralEarnings = (upline.referralEarnings || 0) + commission;
            await upline.save();
        }
    }

    await user.save();
}

module.exports = router;