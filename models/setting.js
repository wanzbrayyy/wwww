const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    websiteTitle: { type: String, default: 'Wanzofc Shop' },
    websiteLogo: { type: String, default: 'https://files.catbox.moe/8u328u.png' },
    websiteFavicon: { type: String, default: 'https://files.catbox.moe/8u328u.png' },
    isMaintenance: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'Website sedang dalam perbaikan. Silakan kembali lagi nanti.' }
});

module.exports = mongoose.model('Setting', SettingSchema);