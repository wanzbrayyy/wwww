const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['balance', 'discount'], required: true },
    value: { type: Number, required: true }, 
    minPurchase: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    quota: { type: Number, default: 100 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Voucher', VoucherSchema);