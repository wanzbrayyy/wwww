const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user');
const PpobOrder = require('../models/ppobOrder');

const API_URL = 'https://jagoanpedia.com/api/ppob';
const API_KEY = '2169-de6d54a0-73d9-4380-ab2e-a51bb2a76d33';

const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/auth/login');
};

router.get('/order', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const response = await axios.post(API_URL, {
            key: API_KEY,
            action: 'services'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        let services = [];
        if (response.data && response.data.data) {
            services = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        }

        res.render('ppob/new-bill-payment', { 
            title: 'Pesan PPOB', 
            css: 'dashboard.css',
            services: services,
            user: user
        });

    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/order', ensureAuthenticated, async (req, res) => {
    const { service_code, target_number, service_name, service_price } = req.body;
    
    try {
        const user = await User.findById(req.session.user.id);
        const price = parseFloat(service_price);

        if (user.balance < price) {
            req.flash('error_msg', 'Saldo tidak mencukupi');
            return res.redirect('/ppob/order');
        }

        const apiPayload = {
            key: API_KEY,
            action: 'order',
            service: service_code,
            target: target_number
        };

        const apiResponse = await axios.post(API_URL, apiPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (apiResponse.data.success === true) {
            user.balance -= price;
            user.monthlySpend = (user.monthlySpend || 0) + price;
            await user.save();
            req.session.user.balance = user.balance;

            await new PpobOrder({
                user: user._id,
                provider_id: apiResponse.data.data.id,
                order_id: apiResponse.data.data.id,
                service_code: service_code,
                product_name: service_name,
                target_number: target_number,
                price: price,
                status: 'Pending'
            }).save();

            req.flash('success_msg', `Pembelian berhasil! ID: ${apiResponse.data.data.id}`);
            res.redirect('/ppob/history');
        } else {
            req.flash('error_msg', `Gagal: ${apiResponse.data.error}`);
            res.redirect('/ppob/order');
        }

    } catch (err) {
        res.redirect('/ppob/order');
    }
});

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const pendingOrders = await PpobOrder.find({ 
            user: user.id, 
            status: { $in: ['Pending'] } 
        });
        
        for (let order of pendingOrders) {
            if (order.provider_id) {
                try {
                    const checkStatus = await axios.post(API_URL, {
                        key: API_KEY, action: 'status', order_id: order.provider_id
                    }, { headers: { 'Content-Type': 'application/json' }});

                    if (checkStatus.data.success) {
                        const data = checkStatus.data.data;
                        order.status = data.status;
                        if (data.sn) order.sn = data.sn;
                        await order.save();
                    }
                } catch (e) { continue; }
            }
        }

        const allOrders = await PpobOrder.find({ user: user.id }).sort({ createdAt: -1 });

        res.render('ppob/history', { 
            title: 'Riwayat PPOB', 
            css: 'dashboard.css',
            orders: allOrders,
            user: user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;