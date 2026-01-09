const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user');
const NokosOrder = require('../models/nokosOrder');

const API_KEY = 'otp_IlsebAaegBpqltRs'; 
const BASE_URL_V2 = 'https://www.rumahotp.com/api/v2';
const BASE_URL_V1 = 'https://www.rumahotp.com/api/v1';

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL_V2}/services`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });

        res.render('nokos/index', {
            title: 'Order Nomor Kosong',
            css: 'dashboard.css',
            services: response.data.data,
            user: req.session.user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.get('/api/countries', ensureAuthenticated, async (req, res) => {
    try {
        const { service_id } = req.query;
        const response = await axios.get(`${BASE_URL_V2}/countries?service_id=${service_id}`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.get('/api/operators', ensureAuthenticated, async (req, res) => {
    try {
        const { country, provider_id } = req.query;
        const encodedCountry = encodeURIComponent(country);
        const response = await axios.get(`${BASE_URL_V2}/operators?country=${encodedCountry}&provider_id=${provider_id}`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/order', ensureAuthenticated, async (req, res) => {
    const { number_id, provider_id, operator_id, price } = req.body;
    
    try {
        const user = await User.findById(req.session.user.id);
        const orderPrice = parseInt(price);

        if (user.balance < orderPrice) {
            req.flash('error_msg', 'Saldo tidak mencukupi');
            return res.redirect('/deposit');
        }

        const response = await axios.get(`${BASE_URL_V2}/orders?number_id=${number_id}&provider_id=${provider_id}&operator_id=${operator_id}`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });

        if (response.data.success) {
            const data = response.data.data;
            
            user.balance -= orderPrice;
            user.monthlySpend = (user.monthlySpend || 0) + orderPrice;
            await user.save();
            
            req.session.user.balance = user.balance;

            const expires = new Date();
            expires.setMinutes(expires.getMinutes() + data.expires_in_minute);

            await new NokosOrder({
                user: user._id,
                order_id: data.order_id,
                service_name: data.service,
                country_name: data.country,
                phone_number: data.phone_number,
                price: orderPrice,
                provider_id: provider_id,
                expires_at: expires
            }).save();

            req.flash('success_msg', 'Nomor berhasil dipesan! Menunggu SMS...');
            res.redirect('/nokos/history');
        } else {
            req.flash('error_msg', 'Gagal memesan nomor. Coba negara/server lain.');
            res.redirect('/nokos');
        }

    } catch (err) {
        req.flash('error_msg', 'Terjadi kesalahan sistem');
        res.redirect('/nokos');
    }
});

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const orders = await NokosOrder.find({ user: req.session.user.id }).sort({ createdAt: -1 });
        res.render('nokos/history', {
            title: 'Riwayat Nokos',
            css: 'dashboard.css',
            orders: orders,
            user: req.session.user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/check-status', ensureAuthenticated, async (req, res) => {
    const { order_id } = req.body;
    try {
        const order = await NokosOrder.findOne({ order_id: order_id, user: req.session.user.id });
        if (!order) return res.json({ success: false });

        const response = await axios.get(`${BASE_URL_V1}/orders/get_status?order_id=${order_id}`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });

        if (response.data.success) {
            const data = response.data.data;
            
            if (data.status !== order.status || data.otp_code !== order.otp_code) {
                order.status = data.status;
                order.otp_code = data.otp_code;
                
                if (data.status === 'canceled') {
                    const user = await User.findById(order.user);
                    user.balance += order.price; 
                    await user.save();
                    req.session.user.balance = user.balance;
                }
                
                await order.save();
            }
            return res.json({ success: true, data: data });
        }
        res.json({ success: false });
    } catch (err) {
        res.json({ success: false });
    }
});

router.post('/set-status', ensureAuthenticated, async (req, res) => {
    const { order_id, status } = req.body; 
    try {
        const response = await axios.get(`${BASE_URL_V1}/orders/set_status?order_id=${order_id}&status=${status}`, {
            headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' }
        });

        if (response.data.success) {
            const order = await NokosOrder.findOne({ order_id: order_id });
            
            if (status === 'cancel' && order.status !== 'canceled') {
                order.status = 'canceled';
                const user = await User.findById(order.user);
                user.balance += order.price;
                await user.save();
                req.session.user.balance = user.balance;
                await order.save();
            }
            
            if (status === 'done') {
                order.status = 'completed';
                await order.save();
            }
            
            return res.json({ success: true });
        }
        res.json({ success: false });
    } catch (err) {
        res.json({ success: false });
    }
});

module.exports = router;