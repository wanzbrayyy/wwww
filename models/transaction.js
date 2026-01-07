const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, required: true },
    deliveryContent: { type: String },
    status: { type: String, default: 'Success' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);