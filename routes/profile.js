const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/user');
const { uploadToCatbox } = require('../utils/catbox');
const { sendEmail } = require('../utils/email');
const otplib = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage() });

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/', ensureAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    res.render('profile/index', { title: 'Profil Saya', css: 'dashboard.css', userData: user });
});

router.post('/update', ensureAuthenticated, upload.single('profile_pic'), async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const { fullname, username } = req.body;

        user.fullname = fullname;
        user.username = username;

        if (req.file) {
            const imageUrl = await uploadToCatbox(req.file.buffer, req.file.originalname);
            user.profile_pic = imageUrl;
            req.session.user.profile_pic = imageUrl;
        }

        await user.save();
        req.session.user.fullname = fullname;
        req.session.user.username = username;

        req.flash('success_msg', 'Profil berhasil diperbarui');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Gagal update profil');
        res.redirect('/profile');
    }
});

router.post('/verify-request', ensureAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    const code = crypto.randomInt(100000, 999999).toString();
    
    user.verificationCode = code;
    await user.save();

    const html = `
        <h2>Verifikasi Email</h2>
        <p>Gunakan kode di bawah ini untuk memverifikasi akun anda:</p>
        <div class="code">${code}</div>
        <p>Jangan berikan kode ini kepada siapapun.</p>
    `;

    await sendEmail(user.email, 'Kode Verifikasi Wanzofc Shop', html);
    res.render('profile/verify', { title: 'Verifikasi Email', css: 'dashboard.css' });
});

router.post('/verify-check', ensureAuthenticated, async (req, res) => {
    const { code } = req.body;
    const user = await User.findById(req.session.user.id);

    if (user.verificationCode === code) {
        user.isVerified = true;
        user.verificationCode = null;
        await user.save();
        req.session.user.isVerified = true;
        req.flash('success_msg', 'Email berhasil diverifikasi');
        res.redirect('/profile');
    } else {
        req.flash('error_msg', 'Kode salah');
        res.render('profile/verify', { title: 'Verifikasi Email', css: 'dashboard.css' });
    }
});

router.get('/2fa', ensureAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    if (user.is2FAEnabled) {
        return res.render('profile/2fa-disable', { title: 'Keamanan 2FA', css: 'dashboard.css' });
    }

    const secret = otplib.authenticator.generateSecret();
    user.twoFASecret = secret;
    await user.save();

    const otpauth = otplib.authenticator.keyuri(user.email, 'Wanzofc Shop', secret);
    const qrImage = await qrcode.toDataURL(otpauth);

    res.render('profile/2fa-enable', { 
        title: 'Aktifkan 2FA', 
        css: 'dashboard.css', 
        qrImage, 
        secret 
    });
});

router.post('/2fa/enable', ensureAuthenticated, async (req, res) => {
    const { token } = req.body;
    const user = await User.findById(req.session.user.id);
    
    const isValid = otplib.authenticator.check(token, user.twoFASecret);
    if (isValid) {
        user.is2FAEnabled = true;
        await user.save();
        req.flash('success_msg', '2FA Google Authenticator Aktif');
        res.redirect('/profile');
    } else {
        req.flash('error_msg', 'Kode Token Salah');
        res.redirect('/profile/2fa');
    }
});

router.post('/2fa/disable', ensureAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    user.is2FAEnabled = false;
    user.twoFASecret = null;
    await user.save();
    req.flash('success_msg', '2FA Dinonaktifkan');
    res.redirect('/profile');
});

module.exports = router;