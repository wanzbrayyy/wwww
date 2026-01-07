const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const User = require('../models/user');
const News = require('../models/news');
const Product = require('../models/product');
const SmmOrder = require('../models/smmOrder');
const PpobOrder = require('../models/ppobOrder');
const Setting = require('../models/setting');
const Voucher = require('../models/voucher');
const { uploadToCatbox } = require('../utils/catbox');
const { sendEmail } = require('../utils/email');

const upload = multer({ storage: multer.memoryStorage() });

const API_URL_SMM = 'https://jagoanpedia.com/api/sosmed';
const API_KEY = '2169-de6d54a0-73d9-4380-ab2e-a51bb2a76d33';

const ensureAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.redirect('/dashboard');
};

router.get('/', ensureAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalSmm = await SmmOrder.countDocuments();
        const totalPpob = await PpobOrder.countDocuments();
        let providerBalance = 0;
        try {
            const response = await axios.post(API_URL_SMM, { key: API_KEY, action: 'profile' });
            if (response.data.success) providerBalance = response.data.data.balance;
        } catch (e) {}

        const incomeSmm = await SmmOrder.aggregate([{ $match: { status: 'Success' } }, { $group: { _id: null, total: { $sum: '$price' } } }]);
        const incomePpob = await PpobOrder.aggregate([{ $match: { status: 'Success' } }, { $group: { _id: null, total: { $sum: '$price' } } }]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            css: 'dashboard.css',
            stats: {
                users: totalUsers, smm: totalSmm, ppob: totalPpob, providerBalance,
                revenue: (incomeSmm[0]?.total || 0) + (incomePpob[0]?.total || 0)
            }
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

router.get('/users', ensureAdmin, async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users/index', { title: 'Kelola User', css: 'dashboard.css', users });
});

router.get('/users/edit/:id', ensureAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    res.render('admin/users/edit', { title: 'Edit User', css: 'dashboard.css', targetUser: user });
});

router.post('/users/edit/:id', ensureAdmin, async (req, res) => {
    const { balance, role, password, isBanned } = req.body;
    try {
        const user = await User.findById(req.params.id);
        user.balance = parseInt(balance);
        user.role = role;
        if (password) user.password = password;
        if (isBanned === 'true') user.role = 'banned';
        await user.save();
        req.flash('success_msg', 'Data user diperbarui');
        res.redirect('/admin/users');
    } catch (err) {
        res.redirect('/admin/users');
    }
});

router.get('/settings', ensureAdmin, async (req, res) => {
    res.render('admin/settings', { title: 'Pengaturan', css: 'dashboard.css' });
});

router.post('/settings', ensureAdmin, upload.fields([{ name: 'logo' }, { name: 'favicon' }]), async (req, res) => {
    const { websiteTitle, isMaintenance, maintenanceMessage } = req.body;
    try {
        let settings = await Setting.findOne();
        settings.websiteTitle = websiteTitle;
        settings.isMaintenance = isMaintenance === 'on';
        settings.maintenanceMessage = maintenanceMessage;
        if (req.files['logo']) settings.websiteLogo = await uploadToCatbox(req.files['logo'][0].buffer, req.files['logo'][0].originalname);
        if (req.files['favicon']) settings.websiteFavicon = await uploadToCatbox(req.files['favicon'][0].buffer, req.files['favicon'][0].originalname);
        await settings.save();
        req.flash('success_msg', 'Pengaturan disimpan');
        res.redirect('/admin/settings');
    } catch (err) {
        res.redirect('/admin/settings');
    }
});

router.get('/broadcast', ensureAdmin, (req, res) => {
    res.render('admin/broadcast', { title: 'Broadcast', css: 'dashboard.css' });
});

router.post('/broadcast', ensureAdmin, async (req, res) => {
    const { subject, message } = req.body;
    try {
        const users = await User.find({}, 'email');
        users.forEach(async (u) => await sendEmail(u.email, subject, message));
        req.flash('success_msg', `Email dikirim ke ${users.length} user`);
        res.redirect('/admin/broadcast');
    } catch (err) {
        res.redirect('/admin/broadcast');
    }
});

router.get('/news', ensureAdmin, async (req, res) => {
    const newsList = await News.find().sort({ createdAt: -1 });
    res.render('admin/news/index', { title: 'Berita', css: 'dashboard.css', newsList });
});

router.get('/news/add', ensureAdmin, (req, res) => {
    res.render('admin/news/add', { title: 'Tambah Berita', css: 'dashboard.css' });
});

router.post('/news/add', ensureAdmin, upload.single('image'), async (req, res) => {
    const { title, category, type, content } = req.body;
    try {
        let imageUrl = '';
        if (req.file) imageUrl = await uploadToCatbox(req.file.buffer, req.file.originalname);
        await new News({ title, category, type, content, image: imageUrl, author: req.session.user.fullname }).save();
        req.flash('success_msg', 'Berita dipublish');
        res.redirect('/admin/news');
    } catch (err) {
        res.redirect('/admin/news/add');
    }
});

router.get('/news/edit/:id', ensureAdmin, async (req, res) => {
    const news = await News.findById(req.params.id);
    res.render('admin/news/edit', { title: 'Edit Berita', css: 'dashboard.css', news });
});

router.post('/news/edit/:id', ensureAdmin, upload.single('image'), async (req, res) => {
    const { title, category, type, content } = req.body;
    try {
        const news = await News.findById(req.params.id);
        news.title = title; news.category = category; news.type = type; news.content = content;
        if (req.file) news.image = await uploadToCatbox(req.file.buffer, req.file.originalname);
        await news.save();
        req.flash('success_msg', 'Berita update');
        res.redirect('/admin/news');
    } catch (err) {
        res.redirect('/admin/news');
    }
});

router.get('/news/delete/:id', ensureAdmin, async (req, res) => {
    await News.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Berita dihapus');
    res.redirect('/admin/news');
});

router.get('/vouchers', ensureAdmin, async (req, res) => {
    const vouchers = await Voucher.find();
    res.render('admin/vouchers', { title: 'Voucher', css: 'dashboard.css', vouchers });
});

router.post('/vouchers/add', ensureAdmin, async (req, res) => {
    const { code, type, value, minPurchase, maxDiscount, quota, days } = req.body;
    try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(days));
        await new Voucher({ code, type, value, minPurchase, maxDiscount, quota, expiresAt }).save();
        req.flash('success_msg', 'Voucher dibuat');
        res.redirect('/admin/vouchers');
    } catch (err) {
        res.redirect('/admin/vouchers');
    }
});

router.get('/flashsale', ensureAdmin, async (req, res) => {
    const products = await Product.find().select('name price flashSalePrice flashSaleEnd');
    res.render('admin/flashsale', { title: 'Flash Sale', css: 'dashboard.css', products });
});

router.post('/flashsale/:id', ensureAdmin, async (req, res) => {
    const { flashSalePrice, duration } = req.body;
    try {
        const product = await Product.findById(req.params.id);
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + parseInt(duration));
        product.flashSalePrice = flashSalePrice;
        product.flashSaleEnd = endDate;
        await product.save();
        req.flash('success_msg', 'Flash sale aktif');
        res.redirect('/admin/flashsale');
    } catch (err) {
        res.redirect('/admin/flashsale');
    }
});

module.exports = router;