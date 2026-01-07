const mongoose = require('mongoose');

const PpobOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider_id: { type: String },
  order_id: { type: String }, 
  service_code: { type: String, required: true },
  product_name: { type: String, required: true },
  target_number: { type: String, required: true },
  price: { type: Number, required: true },
  sn: { type: String, default: '' },
  note: { type: String },
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('PpobOrder', PpobOrderSchema);