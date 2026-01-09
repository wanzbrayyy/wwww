const mongoose = require('mongoose');
const slugify = require('slugify');

const ReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    image: { type: String },
    reply: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const DiscussionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, trim: true },
    isPublic: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const WholesaleSchema = new mongoose.Schema({
    minQty: { type: Number, required: true },
    price: { type: Number, required: true }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0, index: true },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, required: true, index: true },
    tags: [{ type: String, trim: true }],
    
    image: { type: String, default: 'https://files.catbox.moe/8u328u.png' },
    videoPreview: { type: String },
    
    deliveryType: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    deliveryContent: { type: String, select: false },
    
    sold: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    
    flashSalePrice: { type: Number, default: 0 },
    flashSaleStart: { type: Date },
    flashSaleEnd: { type: Date },
    
    isPreorder: { type: Boolean, default: false },
    releaseDate: { type: Date },
    
    wholesalePrices: [WholesaleSchema],
    
    bundleWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    bundlePrice: { type: Number, default: 0 },
    
    reviews: [ReviewSchema],
    averageRating: { type: Number, default: 0, index: true },
    discussions: [DiscussionSchema]
}, { timestamps: true });

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

ProductSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, { lower: true, strict: true }) + '-' + Date.now().toString().slice(-6);
    }

    if (this.reviews.length > 0) {
        const total = this.reviews.reduce((acc, item) => acc + item.rating, 0);
        this.averageRating = parseFloat((total / this.reviews.length).toFixed(1));
    } else {
        this.averageRating = 0;
    }

    next();
});

module.exports = mongoose.model('Product', ProductSchema);