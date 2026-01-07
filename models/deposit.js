const mongoose = require('mongoose');

const DepositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Success', 'Failed', 'Expired'] },
  snap_token: { type: String },
  payment_type: { type: String },
  payment_time: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Deposit', DepositSchema);