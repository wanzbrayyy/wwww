const express = require('express');
const router = express.Router();
const multer = require('multer');
const Product = require('../models/product');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const Voucher = require('../models/voucher');
const { uploadToCatbox } = require('../utils/catbox');
const { sendEmail } = require('../utils/email');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error_msg', 'Silakan login terlebih dahulu untuk melakukan aksi ini');
    res.redirect('/auth/login');
};

const ensureSeller = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'seller' || req.session.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'Akses khusus Seller');
    res.redirect('/marketplace');
};

router.post('/api/upload', ensureAuthenticated, ensureSeller, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const url = await uploadToCatbox(req.file.buffer, req.file.originalname);
        res.json({ success: true, url: url });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { sort, category, search } = req.query;
        let query = {};
        let sortOption = { createdAt: -1 };

        if (category) query.category = category;
        if (search) query.name = { $regex: search, $options: 'i' };

        if (sort === 'price_low') sortOption = { price: 1 };
        if (sort === 'price_high') sortOption = { price: -1 };
        if (sort === 'bestseller') sortOption = { sold: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };

        const products = await Product.find(query).populate('seller', 'username').sort(sortOption);
        
        res.render('marketplace/index', {
            title: 'Marketplace',
            css: 'dashboard.css',
            products,
            user: req.session.user || null, // Kirim null jika belum login
            query: req.query
        });
    } catch (err) {
        res.redirect('/');
    }
});

// HAPUS ensureAuthenticated agar bisa diakses publik
router.get('/product/:slug', async (req, res) => {
    try {
        const product = await Product.findOne({ slug: req.params.slug })
            .populate('seller', 'username fullname profile_pic isVerified')
            .populate('reviews.user', 'username profile_pic');

        if (!product) return res.redirect('/marketplace');
        
        let hasBought = false;
        if (req.session.user) {
            const transaction = await Transaction.findOne({ 
                buyer: req.session.user.id, 
                product: product._id 
            });
            hasBought = !!transaction;
        }

        res.render('marketplace/detail', {
            title: product.name,
            css: 'dashboard.css',
            product,
            hasBought: hasBought,
            user: req.session.user || null // Kirim null jika belum login
        });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.get('/store/:sellerId', async (req, res) => {
    try {
        const seller = await User.findById(req.params.sellerId);
        const products = await Product.find({ seller: seller._id }).sort({ createdAt: -1 });
        
        res.render('marketplace/store', {
            title: `Toko ${seller.username}`,
            css: 'dashboard.css',
            seller,
            products,
            currentUser: req.session.user || null
        });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.get('/add', ensureAuthenticated, ensureSeller, (req, res) => {
    res.render('marketplace/add', { title: 'Jual Produk', css: 'dashboard.css' });
});

router.post('/add', ensureAuthenticated, ensureSeller, upload.single('image'), async (req, res) => {
    const { name, description, price, category, deliveryType, deliveryContent } = req.body;
    try {
        let imageUrl = 'https://files.catbox.moe/8u328u.png';
        if (req.file) {
            imageUrl = await uploadToCatbox(req.file.buffer, req.file.originalname);
        }

        const newProduct = new Product({
            seller: req.session.user.id,
            name, description, price, category,
            image: imageUrl,
            deliveryType,
            deliveryContent
        });

        await newProduct.save();
        req.flash('success_msg', 'Produk berhasil dijual');
        res.redirect('/marketplace');
    } catch (err) {
        res.redirect('/marketplace/add');
    }
});

router.get('/edit/:id', ensureAuthenticated, ensureSeller, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product.seller.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.redirect('/marketplace');
        }
        res.render('marketplace/edit', { title: 'Edit Produk', css: 'dashboard.css', product });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.post('/edit/:id', ensureAuthenticated, ensureSeller, upload.single('image'), async (req, res) => {
    const { name, description, price, category, deliveryType, deliveryContent } = req.body;
    try {
        const product = await Product.findById(req.params.id);
        if (product.seller.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.redirect('/marketplace');
        }
        product.name = name;
        product.description = description;
        product.price = price;
        product.category = category;
        product.deliveryType = deliveryType;
        product.deliveryContent = deliveryContent;
        if (req.file) {
            product.image = await uploadToCatbox(req.file.buffer, req.file.originalname);
        }
        await product.save();
        res.redirect(`/marketplace/store/${product.seller}`);
    } catch (err) {
        res.redirect(`/marketplace/edit/${req.params.id}`);
    }
});

router.get('/delete/:id', ensureAuthenticated, ensureSeller, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product.seller.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.redirect('/marketplace');
        }
        await Product.findByIdAndDelete(req.params.id);
        res.redirect(`/marketplace/store/${req.session.user.id}`);
    } catch (err) {
        res.redirect('/marketplace');
    }
});

// TAMBAHKAN ensureAuthenticated untuk melindungi aksi beli
router.post('/buy/:id', ensureAuthenticated, async (req, res) => {
    const { voucherCode } = req.body;
    try {
        const product = await Product.findById(req.params.id);
        const buyer = await User.findById(req.session.user.id);
        const seller = await User.findById(product.seller);

        if (buyer.id === seller.id) {
            req.flash('error_msg', 'Tidak bisa membeli produk sendiri');
            return res.redirect('/marketplace/product/' + product.slug);
        }

        let finalPrice = product.price;
        if (product.flashSaleEnd > new Date() && product.flashSalePrice > 0) {
            finalPrice = product.flashSalePrice;
        } else {
            if (buyer.rank === 'Silver') finalPrice *= 0.98;
            if (buyer.rank === 'Gold') finalPrice *= 0.95;
        }

        if (voucherCode) {
            const voucher = await Voucher.findOne({ code: voucherCode, type: 'discount' });
            if (voucher && voucher.quota > 0 && !voucher.usedBy.includes(buyer.id) && voucher.expiresAt > new Date()) {
                if (finalPrice >= voucher.minPurchase) {
                    let discount = (finalPrice * voucher.value) / 100;
                    if (discount > voucher.maxDiscount) discount = voucher.maxDiscount;
                    finalPrice -= discount;
                    
                    voucher.quota -= 1;
                    voucher.usedBy.push(buyer._id);
                    await voucher.save();
                }
            }
        }

        finalPrice = Math.ceil(finalPrice);
        if (buyer.balance < finalPrice) {
            req.flash('error_msg', 'Saldo tidak mencukupi');
            return res.redirect('/marketplace/product/' + product.slug);
        }

        buyer.balance -= finalPrice;
        seller.balance += finalPrice;
        buyer.monthlySpend = (buyer.monthlySpend || 0) + finalPrice;
        product.sold += 1;

        const transaction = new Transaction({
            buyer: buyer._id, product: product._id, seller: seller._id, price: finalPrice,
            deliveryContent: product.deliveryType === 'auto' ? product.deliveryContent : 'Manual via Chat.'
        });

        await buyer.save();
        await seller.save();
        await product.save();
        await transaction.save();

        req.session.user.balance = buyer.balance;

        if (product.deliveryType === 'auto') {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                    <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                        <h2 style="color: #3b82f6; margin: 0;">WANZOFC SHOP</h2>
                    </div>
                    <div style="padding: 20px; background-color: #ffffff; color: #334155;">
                        <h3 style="margin-top: 0;">Pembelian Berhasil!</h3>
                        <p>Halo <strong>${buyer.username}</strong>,</p>
                        <p>Terima kasih telah membeli produk <strong>${product.name}</strong>.</p>
                        
                        <div style="margin: 25px 0; padding: 20px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0f172a;">Akses Produk Anda:</p>
                            ${isUrl ? 
                                `<a href="${product.deliveryContent}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 5px;">
                                    <i class="fa-solid fa-download"></i> Download File Sekarang
                                 </a>
                                 <p style="margin-top: 10px; font-size: 12px; color: #64748b;">Atau copy link: <br> ${product.deliveryContent}</p>` 
                                : 
                                `<pre style="background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto; font-family: monospace;">${product.deliveryContent}</pre>`
                            }
                        </div>

                        <p style="font-size: 13px;">jika link tidak berfungsi atau ada masalah akun, silakan hubungi penjual melalui menu Chat di website.</p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                        &copy; 2026 wanzofc shop. all rights reserved.
                    </div>
                </div>
            `;
            
            await sendEmail(buyer.email, `[Wanzofc] Akses Produk: ${product.name}`, emailHtml);
            req.flash('success_msg', 'Pembelian sukses! Link download telah dikirim otomatis ke Email anda.');
        } else {
            req.flash('success_msg', 'Pembelian sukses! Silakan Chat Penjual untuk proses pengiriman.');
            return res.redirect(`/chat/${seller._id}`);
        }

        res.redirect('/marketplace/product/' + product.slug);

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Transaksi gagal: ' + err.message);
        res.redirect('/marketplace');
    }
});

// TAMBAHKAN ensureAuthenticated untuk melindungi aksi review
router.post('/review/:id', ensureAuthenticated, async (req, res) => {
    const { rating, comment } = req.body;
    try {
        const product = await Product.findById(req.params.id);
        const hasBought = await Transaction.findOne({ buyer: req.session.user.id, product: product._id });
        
        if (!hasBought || product.reviews.find(r => r.user.toString() === req.session.user.id.toString())) {
            return res.redirect('/marketplace/product/' + product.slug);
        }

        product.reviews.push({ user: req.session.user.id, rating: parseInt(rating), comment });
        await product.save();
        req.flash('success_msg', 'Ulasan terkirim');
        res.redirect('/marketplace/product/' + product.slug);
    } catch (err) {
        res.redirect('/marketplace');
    }
});

module.exports = router;
