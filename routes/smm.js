const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user');
const SmmOrder = require('../models/smmOrder');

const API_URL = 'https://jagoanpedia.com/api/sosmed';
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

        res.render('smm/new-order', { 
            title: 'Pesan SMM', 
            css: 'dashboard.css',
            services: services,
            user: user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.post('/order', ensureAuthenticated, async (req, res) => {
    const { service_id, target_link, quantity, custom_comments, service_price, service_name } = req.body;
    
    try {
        const user = await User.findById(req.session.user.id);
        const totalPrice = (parseInt(quantity) / 1000) * parseFloat(service_price);

        if (user.balance < totalPrice) {
            req.flash('error_msg', 'Saldo tidak mencukupi');
            return res.redirect('/smm/order');
        }

        const apiPayload = {
            key: API_KEY,
            action: 'order',
            service: service_id,
            target: target_link,
            quantity: quantity,
            custom_comments: custom_comments || undefined
        };

        const apiResponse = await axios.post(API_URL, apiPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (apiResponse.data.success === true) {
            user.balance -= totalPrice;
            user.monthlySpend = (user.monthlySpend || 0) + totalPrice;
            await user.save();
            req.session.user.balance = user.balance;

            await new SmmOrder({
                user: user._id,
                order_id: apiResponse.data.data.id, 
                provider_id: apiResponse.data.data.id,
                service_name: service_name, 
                target_link: target_link,
                quantity: quantity,
                price: totalPrice,
                status: 'Pending'
            }).save();

            req.flash('success_msg', `Pesanan berhasil! ID: ${apiResponse.data.data.id}`);
            res.redirect('/smm/history');
        } else {
            req.flash('error_msg', `Gagal: ${apiResponse.data.error}`);
            res.redirect('/smm/order');
        }

    } catch (err) {
        req.flash('error_msg', 'Terjadi kesalahan sistem');
        res.redirect('/smm/order');
    }
});

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const pendingOrders = await SmmOrder.find({ 
            user: user.id, 
            status: { $in: ['Pending', 'Processing'] } 
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
                        order.start_count = data.start_count;
                        order.remains = data.remains;
                        await order.save();
                    }
                } catch (e) { continue; }
            }
        }

        const allOrders = await SmmOrder.find({ user: user.id }).sort({ createdAt: -1 });

        res.render('smm/history', { 
            title: 'Riwayat SMM', 
            css: 'dashboard.css',
            orders: allOrders,
            user: user
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

module.exports = router;