const express = require('express');
const router = express.Router();
const User = require('../models/user');
const otplib = require('otplib');

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('auth/login', { title: 'Login - Wanzofc', css: 'auth.css' });
});

router.post('/login', async (req, res) => {
    const { username, password, role, token } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            req.flash('error_msg', 'Username tidak ditemukan');
            return res.redirect('/auth/login');
        }

        if (user.role !== role && role !== 'admin') { 
            req.flash('error_msg', `Akun anda bukan terdaftar sebagai ${role}`);
            return res.redirect('/auth/login');
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            req.flash('error_msg', 'Password salah');
            return res.redirect('/auth/login');
        }

        if (user.is2FAEnabled) {
            if (!token) {
                return res.render('auth/2fa-challenge', { 
                    title: 'Verifikasi 2FA', 
                    css: 'auth.css',
                    username, role, password 
                });
            }
            const isValid = otplib.authenticator.check(token, user.twoFASecret);
            if (!isValid) {
                req.flash('error_msg', 'Kode Authenticator salah');
                return res.redirect('/auth/login');
            }
        }

        req.session.user = {
            id: user._id,
            username: user.username,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            profile_pic: user.profile_pic,
            isVerified: user.isVerified
        };

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/auth/login');
    }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Daftar - wanzofc shop', css: 'auth.css' });
});

router.post('/register', async (req, res) => {
  const { fullname, username, email, password, confirm_password, referral } = req.body;
  
  if (password !== confirm_password) {
    req.flash('error_msg', 'Password tidak cocok');
    return res.redirect('/auth/register');
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      req.flash('error_msg', 'Email sudah terdaftar');
      return res.redirect('/auth/register');
    }

    const newUser = new User({ 
        fullname, username, email, password,
        referredBy: referral || null 
    });
    await newUser.save();

    req.flash('success_msg', 'Registrasi berhasil, silakan login');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Terjadi kesalahan saat registrasi');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;