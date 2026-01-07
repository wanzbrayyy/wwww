const mongoose = require('mongoose');
const slugify = require('slugify');

const ReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, required: true },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, default: 'https://files.catbox.moe/8u328u.png' },
  sold: { type: Number, default: 0 },
  deliveryType: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  deliveryContent: { type: String }, 
  reviews: [ReviewSchema],
  averageRating: { type: Number, default: 0 },
  
  flashSalePrice: { type: Number, default: 0 },
  flashSaleEnd: { type: Date }
}, { timestamps: true });

ProductSchema.pre('save', function(next) {
    if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true }) + '-' + Date.now();
    }
    if (this.reviews.length > 0) {
        const total = this.reviews.reduce((acc, item) => acc + item.rating, 0);
        this.averageRating = total / this.reviews.length;
    }
    next();
});

module.exports = mongoose.model('Product', ProductSchema);