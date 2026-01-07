const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');
const User = require('../models/user');
const moment = require('moment');

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/auth/login');
};

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const chats = await Chat.aggregate([
            { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
        ]);
        const allChats = await Chat.find({
            $or: [{ sender: userId }, { receiver: userId }]
        }).sort({ createdAt: -1 }).populate('sender receiver', 'username profile_pic');

        const chatList = [];
        const seenUsers = new Set();

        for (const chat of allChats) {
            const partner = chat.sender._id.toString() === userId ? chat.receiver : chat.sender;
            if (!seenUsers.has(partner._id.toString())) {
                seenUsers.add(partner._id.toString());
                chatList.push({
                    partner,
                    lastMessage: chat.message,
                    time: moment(chat.createdAt).fromNow()
                });
            }
        }

        res.render('chat/list', { title: 'Pesan', css: 'dashboard.css', chatList });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

router.get('/:partnerId', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const partnerId = req.params.partnerId;
        const partner = await User.findById(partnerId);

        const messages = await Chat.find({
            $or: [
                { sender: userId, receiver: partnerId },
                { sender: partnerId, receiver: userId }
            ]
        }).sort({ createdAt: 1 });

        res.render('chat/room', { 
            title: `Chat ${partner.username}`, 
            css: 'dashboard.css',
            partner,
            messages,
            userId,
            moment
        });
    } catch (err) {
        res.redirect('/chat');
    }
});

router.post('/send', ensureAuthenticated, async (req, res) => {
    const { receiverId, message } = req.body;
    try {
        await new Chat({
            sender: req.session.user.id,
            receiver: receiverId,
            message
        }).save();
        res.redirect(`/chat/${receiverId}`);
    } catch (err) {
        res.redirect('/chat');
    }
});

module.exports = router;