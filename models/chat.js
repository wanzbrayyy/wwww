const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    originalMessage: { type: String },
    language: { type: String, default: 'id' }, 
    translations: {
        en: { type: String },
        id: { type: String },
        ja: { type: String },
        ar: { type: String }
    },
    
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);