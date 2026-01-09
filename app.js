const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/user'); 

// Middleware Custom (Pastikan file ini ada, jika tidak, hapus baris ini)
const systemMiddleware = require('./middleware/system');
const seoMiddleware = require('./middleware/seo');

dotenv.config();

const app = express();

// Database Connection
connectDB();

// Konfigurasi Express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'wanzofc_secret_key_secure',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 Jam
        httpOnly: true
    } 
}));

// Flash Messages
app.use(flash());

// GLOBAL MIDDLEWARE: User Refresh & Variables
app.use(async (req, res, next) => {
    // Global Variables untuk Flash Message
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');

    // AUTO REFRESH USER DATA (Supaya Saldo Real-time di Navbar)
    if (req.session && req.session.user) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const freshUser = await User.findById(userId);
            
            if (freshUser) {
                // Update session dengan data terbaru dari DB
                req.session.user = freshUser;
                // Kirim data user ke semua file EJS (navbar/header)
                res.locals.user = freshUser;
                res.locals.currentUser = freshUser; // Alias untuk kompatibilitas
            } else {
                // Jika user dihapus dari DB, hapus session
                req.session.user = null;
                res.locals.user = null;
                res.locals.currentUser = null;
            }
        } catch (err) {
            console.error("Session Refresh Error:", err.message);
            res.locals.user = null;
            res.locals.currentUser = null;
        }
    } else {
        res.locals.user = null;
        res.locals.currentUser = null;
    }
    next();
});

// Load Custom Middleware (Jika file ada)
try {
    if (systemMiddleware) app.use(systemMiddleware);
    if (seoMiddleware) app.use(seoMiddleware);
} catch (e) {
    console.log("Middleware tambahan dilewati.");
}

// --- ROUTES ---
app.use('/', require('./routes/seo'));
app.use('/', require('./routes/dashboard'));
app.use('/auth', require('./routes/auth'));
app.use('/smm', require('./routes/smm'));
app.use('/ppob', require('./routes/ppob'));
app.use('/nokos', require('./routes/nokos')); // Fitur Baru Nokos
app.use('/deposit', require('./routes/deposit'));
app.use('/admin', require('./routes/admin'));
app.use('/marketplace', require('./routes/marketplace'));
app.use('/chat', require('./routes/chat'));
app.use('/bonus', require('./routes/bonus'));
app.use('/tools', require('./routes/tools'));
app.use('/news', require('./routes/news'));
app.use('/profile', require('./routes/profile'));
app.use('/api', require('./routes/api'));

// 404 Handler (Halaman Tidak Ditemukan)
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Halaman Tidak Ditemukan',
        user: req.session.user || null 
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});