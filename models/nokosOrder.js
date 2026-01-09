const mongoose = require('mongoose');

const NokosOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order_id: { type: String, required: true },
    service_name: { type: String, required: true },
    country_name: { type: String, required: true },
    phone_number: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, default: 'waiting' },
    otp_code: { type: String, default: '-' },
    provider_id: { type: String }, 
    expires_at: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('NokosOrder', NokosOrderSchema);