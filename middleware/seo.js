module.exports = (req, res, next) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    
    res.locals.seo = {
        title: 'wanzofc Shop - Solusi Digital Terbaik',
        description: 'Platform topup game, PPOB, SMM, dan marketplace produk digital terlengkap dan termurah di Indonesia.',
        image: 'https://files.catbox.moe/kg8vzm.png',
        url: fullUrl,
        type: 'website',
        schema: null 
    };
    
    res.locals.analytics = {
        ga_id: 'G-GTT8RVK0ND', 
        fb_pixel_id: '123456789012345' 
    };

    next();
};