const mongoose = require('mongoose');

const SmmOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order_id: { type: String }, 
  provider_id: { type: String },
  service_name: { type: String, required: true },
  target_link: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  start_count: { type: Number, default: 0 },
  remains: { type: Number, default: 0 },
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('SmmOrder', SmmOrderSchema);