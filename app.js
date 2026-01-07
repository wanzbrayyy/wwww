const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const systemMiddleware = require('./middleware/system');
const seoMiddleware = require('./middleware/seo');

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'wanzofc_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null; 
  next();
});

const startServer = async () => {
    try {
        await connectDB();
        
        app.use(systemMiddleware);
        app.use(seoMiddleware);

        app.use('/', require('./routes/seo'));
        app.use('/', require('./routes/dashboard'));
        app.use('/auth', require('./routes/auth'));
        app.use('/smm', require('./routes/smm'));
        app.use('/ppob', require('./routes/ppob'));
        app.use('/deposit', require('./routes/deposit'));
        app.use('/admin', require('./routes/admin'));
        app.use('/marketplace', require('./routes/marketplace'));
        app.use('/chat', require('./routes/chat'));
        app.use('/bonus', require('./routes/bonus'));
        app.use('/tools', require('./routes/tools'));
        app.use('/news', require('./routes/news'));
        app.use('/profile', require('./routes/profile'));
        app.use('/api', require('./routes/api'));

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server berjalan di port ${PORT}`);
        });

    } catch (err) {
        console.error("Gagal menjalankan server:", err);
        process.exit(1);
    }
};

startServer();