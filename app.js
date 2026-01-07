const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
dotenv.config();
connectDB();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 hari
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.title = 'Wanzofc Shop'; 
  res.locals.path = req.path;
  next();
});
const systemMiddleware = require('./middleware/system');

app.use(systemMiddleware);

app.use('/', require('./routes/dashboard'));
app.use('/auth', require('./routes/auth'));
app.use('/smm', require('./routes/smm'));
app.use('/ppob', require('./routes/ppob'));
app.use('/deposit', require('./routes/deposit'));
app.use('/profile', require('./routes/profile'));
app.use('/news', require('./routes/news'));
app.use('/marketplace', require('./routes/marketplace'));
app.use('/admin', require('./routes/admin'));
app.use('/chat', require('./routes/chat'));
app.use('/bonus', require('./routes/bonus'));
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});

module.exports = app; 