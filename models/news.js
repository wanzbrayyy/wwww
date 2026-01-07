const mongoose = require('mongoose');
const slugify = require('slugify');

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  content: { type: String, required: true },
  image: { type: String },
  author: { type: String, default: 'Admin' },
  category: { type: String, required: true, enum: ['info', 'service', 'maintenance', 'promo'] },
  type: { type: String, default: 'all', enum: ['all', 'member', 'seller'] }
}, { timestamps: true });

NewsSchema.pre('save', function(next) {
    if (this.title) {
        this.slug = slugify(this.title, { lower: true, strict: true }) + '-' + Date.now();
    }
    next();
});

module.exports = mongoose.model('News', NewsSchema);