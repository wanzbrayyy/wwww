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
    limits: { fileSize: 500 * 1024 * 1024 }
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
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
};

router.use(refreshUser);

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    res.redirect('/auth/login');
};

const ensureSeller = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'seller' || req.session.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'Akses khusus Seller');
    res.redirect('/marketplace');
};

router.get('/', async (req, res) => {
    try {
        const { sort, category, search, minPrice, maxPrice, rating, page = 1 } = req.query;
        const limit = 12;
        const skip = (page - 1) * limit;
        
        let query = { isActive: true };
        let sortOption = { createdAt: -1 };

        if (category) query.category = category;
        if (search) query.$text = { $search: search };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }
        if (rating) query.averageRating = { $gte: parseInt(rating) };

        if (sort === 'price_low') sortOption = { price: 1 };
        if (sort === 'price_high') sortOption = { price: -1 };
        if (sort === 'bestseller') sortOption = { sold: -1 };
        if (sort === 'views') sortOption = { views: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('seller', 'username isVerified')
            .sort(sortOption)
            .skip(skip)
            .limit(limit);
        
        res.render('marketplace/index', {
            title: 'Marketplace',
            css: 'dashboard.css',
            products,
            query: req.query,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(totalProducts / limit),
                total: totalProducts
            }
        });
    } catch (err) {
        res.redirect('/');
    }
});

router.get('/product/:slug', async (req, res) => {
    try {
        const product = await Product.findOne({ slug: req.params.slug })
            .populate('seller', 'username fullname profile_pic isVerified lastActive')
            .populate('reviews.user', 'username profile_pic')
            .populate('bundleWith', 'name slug price image')
            .populate('discussions.user', 'username profile_pic');

        if (!product) return res.redirect('/marketplace');

        product.views += 1;
        await product.save();

        const relatedProducts = await Product.find({ 
            category: product.category, 
            _id: { $ne: product._id },
            isActive: true 
        }).limit(4);
        
        let hasBought = false;
        if (req.session.user) {
            const userId = req.session.user.id || req.session.user._id;
            const transaction = await Transaction.findOne({ 
                buyer: userId, 
                product: product._id 
            });
            hasBought = !!transaction;
        }

        res.render('marketplace/detail', {
            title: product.name,
            css: 'dashboard.css',
            product,
            relatedProducts,
            hasBought
        });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.post('/buy/:id', ensureAuthenticated, async (req, res) => {
    let productSlug = '';
    
    try {
        const { voucherCode, quantity = 1 } = req.body;
        const qty = parseInt(quantity);
        const userId = req.session.user.id || req.session.user._id;
        
        const product = await Product.findById(req.params.id).select('+deliveryContent');
        if (!product) throw new Error('Produk tidak ditemukan.');
        productSlug = product.slug;

        const buyer = await User.findById(userId);
        const seller = await User.findById(product.seller);

        if (!product.isActive) throw new Error('Produk ini sedang diarsipkan.');
        if (product.stock < qty) throw new Error(`Stok tidak mencukupi (Sisa: ${product.stock}).`);
        if (buyer.id.toString() === seller.id.toString()) throw new Error('Tidak dapat membeli produk sendiri.');

        let unitPrice = product.price;
        const now = new Date();
        
        if (product.flashSaleEnd > now && product.flashSaleStart < now && product.flashSalePrice > 0) {
            unitPrice = product.flashSalePrice;
        }

        if (product.wholesalePrices && product.wholesalePrices.length > 0) {
            const applicableWholesale = product.wholesalePrices
                .sort((a, b) => b.minQty - a.minQty)
                .find(w => qty >= w.minQty);
            if (applicableWholesale) unitPrice = applicableWholesale.price;
        }

        if (buyer.rank === 'Silver') unitPrice *= 0.98;
        if (buyer.rank === 'Gold') unitPrice *= 0.95;

        let totalPrice = unitPrice * qty;

        if (voucherCode) {
            const voucher = await Voucher.findOne({ code: voucherCode, type: 'discount' });
            if (voucher && voucher.quota > 0 && !voucher.usedBy.includes(buyer.id) && voucher.expiresAt > now) {
                if (totalPrice >= voucher.minPurchase) {
                    let discount = (totalPrice * voucher.value) / 100;
                    if (discount > voucher.maxDiscount) discount = voucher.maxDiscount;
                    totalPrice -= discount;
                    
                    voucher.quota -= 1;
                    voucher.usedBy.push(buyer._id);
                    await voucher.save();
                }
            }
        }

        totalPrice = Math.ceil(totalPrice);

        if (buyer.balance < totalPrice) {
            throw new Error('Saldo tidak mencukupi');
        }

        buyer.balance -= totalPrice;
        buyer.monthlySpend = (buyer.monthlySpend || 0) + totalPrice;
        seller.balance += totalPrice;
        product.stock -= qty;
        product.sold += qty;

        await buyer.save();
        await seller.save();
        await product.save();

        req.session.user = buyer;
        await new Promise((resolve) => req.session.save(resolve));

        const transaction = new Transaction({
            buyer: buyer._id,
            product: product._id,
            seller: seller._id,
            price: totalPrice,
            quantity: qty,
            deliveryContent: product.deliveryType === 'auto' ? product.deliveryContent : 'Manual via Chat.'
        });
        await transaction.save();

        if (product.deliveryType === 'auto') {
            const emailHtml = `
                <div style="font-family:Arial;padding:20px;border:1px solid #ddd;">
                    <h2 style="color:#3b82f6;">Terima Kasih!</h2>
                    <p>Pembelian <strong>${product.name}</strong> berhasil.</p>
                    <div style="background:#f1f5f9;padding:15px;border-radius:5px;margin:20px 0;">
                        <strong>Akses Produk:</strong><br>
                        <pre style="white-space:pre-wrap;">${product.deliveryContent}</pre>
                    </div>
                    <small>Total Bayar: Rp ${totalPrice.toLocaleString()}</small>
                </div>
            `;
            sendEmail(buyer.email, `[Order #${transaction._id}] Pembelian Berhasil`, emailHtml).catch(() => {});
            
            req.flash('success_msg', 'Pembelian Berhasil! Akses produk telah dikirim ke Email.');
            res.redirect('/marketplace/product/' + productSlug);
        } else {
            req.flash('success_msg', 'Pembelian Berhasil! Silakan hubungi penjual.');
            res.redirect(`/chat/${seller._id}`);
        }

    } catch (err) {
        req.flash('error_msg', err.message);
        if (productSlug) {
            res.redirect('/marketplace/product/' + productSlug);
        } else {
            res.redirect('/marketplace');
        }
    }
});

router.post('/review/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const userId = req.session.user.id || req.session.user._id;
        const product = await Product.findById(req.params.id);

        if (!product) return res.redirect('/marketplace');

        const transaction = await Transaction.findOne({ 
            buyer: userId, 
            product: product._id 
        });

        if (!transaction) {
            req.flash('error_msg', 'Anda belum membeli produk ini.');
            return res.redirect('/marketplace/product/' + product.slug);
        }

        const alreadyReviewed = product.reviews.some(r => r.user.toString() === userId.toString());
        if (alreadyReviewed) {
            req.flash('error_msg', 'Anda sudah memberikan ulasan.');
            return res.redirect('/marketplace/product/' + product.slug);
        }
        
        product.reviews.push({ 
            user: userId, 
            rating: parseInt(rating), 
            comment 
        });
        
        await product.save();
        req.flash('success_msg', 'Ulasan berhasil dikirim!');
        res.redirect('/marketplace/product/' + product.slug);
    } catch (err) {
        req.flash('error_msg', 'Gagal mengirim ulasan.');
        res.redirect('/marketplace');
    }
});

router.get('/store/:sellerId', async (req, res) => {
    try {
        const seller = await User.findById(req.params.sellerId);
        if (!seller) return res.redirect('/marketplace');
        const products = await Product.find({ seller: seller._id, isActive: true }).sort({ createdAt: -1 });
        const totalSold = products.reduce((acc, curr) => acc + curr.sold, 0);
        res.render('marketplace/store', {
            title: `Toko ${seller.username}`,
            css: 'dashboard.css',
            seller,
            products,
            totalSold,
            currentUser: req.session.user || null
        });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.get('/add', ensureAuthenticated, ensureSeller, (req, res) => {
    res.render('marketplace/add', { title: 'Jual Produk', css: 'dashboard.css' });
});

router.post('/add', ensureAuthenticated, ensureSeller, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, price, stock, category, tags, deliveryType, deliveryContent, isPreorder, releaseDate, flashSalePrice, flashSaleStart, flashSaleEnd, wholesalePrices } = req.body;
        let imageUrl = 'https://files.catbox.moe/8u328u.png';
        let videoUrl = '';
        if (req.files['image']) imageUrl = await uploadToCatbox(req.files['image'][0].buffer, req.files['image'][0].originalname);
        if (req.files['video']) videoUrl = await uploadToCatbox(req.files['video'][0].buffer, req.files['video'][0].originalname);

        let parsedWholesale = [];
        try { parsedWholesale = JSON.parse(wholesalePrices || '[]'); } catch (e) {}

        const newProduct = new Product({
            seller: req.session.user.id || req.session.user._id,
            name, description, price: parseInt(price), stock: parseInt(stock), category,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            image: imageUrl, videoPreview: videoUrl,
            deliveryType, deliveryContent,
            isPreorder: !!isPreorder, releaseDate: isPreorder ? new Date(releaseDate) : null,
            flashSalePrice: parseInt(flashSalePrice) || 0,
            flashSaleStart: flashSaleStart ? new Date(flashSaleStart) : null,
            flashSaleEnd: flashSaleEnd ? new Date(flashSaleEnd) : null,
            wholesalePrices: parsedWholesale
        });

        await newProduct.save();
        req.flash('success_msg', 'Produk berhasil dijual');
        res.redirect('/marketplace');
    } catch (err) {
        req.flash('error_msg', 'Gagal: ' + err.message);
        res.redirect('/marketplace/add');
    }
});

router.get('/edit/:id', ensureAuthenticated, ensureSeller, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const userId = req.session.user.id || req.session.user._id;
        if (product.seller.toString() !== userId && req.session.user.role !== 'admin') return res.redirect('/marketplace');
        res.render('marketplace/edit', { title: 'Edit Produk', css: 'dashboard.css', product });
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.post('/edit/:id', ensureAuthenticated, ensureSeller, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const product = await Product.findById(req.params.id);
        if (product.seller.toString() !== userId && req.session.user.role !== 'admin') return res.redirect('/marketplace');
        
        const { name, description, price, stock, category, tags, isActive, deliveryType, deliveryContent, flashSalePrice, flashSaleStart, flashSaleEnd } = req.body;
        product.name = name; product.description = description; product.price = parseInt(price); product.stock = parseInt(stock);
        product.category = category; product.tags = tags ? tags.split(',').map(t => t.trim()) : [];
        product.isActive = !!isActive; product.deliveryType = deliveryType;
        product.flashSalePrice = parseInt(flashSalePrice) || 0;
        product.flashSaleStart = flashSaleStart ? new Date(flashSaleStart) : null;
        product.flashSaleEnd = flashSaleEnd ? new Date(flashSaleEnd) : null;
        
        if (deliveryContent) product.deliveryContent = deliveryContent;
        if (req.files['image']) product.image = await uploadToCatbox(req.files['image'][0].buffer, req.files['image'][0].originalname);
        if (req.files['video']) product.videoPreview = await uploadToCatbox(req.files['video'][0].buffer, req.files['video'][0].originalname);
        
        await product.save();
        req.flash('success_msg', 'Produk diperbarui');
        res.redirect(`/marketplace/store/${product.seller}`);
    } catch (err) {
        res.redirect(`/marketplace/edit/${req.params.id}`);
    }
});

router.post('/delete/:id', ensureAuthenticated, ensureSeller, async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const product = await Product.findById(req.params.id);
        if (product.seller.toString() !== userId && req.session.user.role !== 'admin') return res.redirect('/marketplace');
        await Product.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Produk dihapus');
        res.redirect(`/marketplace/store/${userId}`);
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.post('/discuss/:id', ensureAuthenticated, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        product.discussions.push({ user: req.session.user.id || req.session.user._id, question: req.body.question });
        await product.save();
        res.redirect('/marketplace/product/' + product.slug);
    } catch (err) {
        res.redirect('/marketplace');
    }
});

router.post('/api/upload', ensureAuthenticated, ensureSeller, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const url = await uploadToCatbox(req.file.buffer, req.file.originalname);
        res.json({ success: true, url });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;