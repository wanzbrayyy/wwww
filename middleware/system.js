const Setting = require('../models/setting');

const systemMiddleware = async (req, res, next) => {
    try {
        let settings = await Setting.findOne().maxTimeMS(2000); 
        if (!settings) {
            settings = {
                websiteTitle: 'Wanzofc Shop',
                websiteLogo: 'https://files.catbox.moe/8u328u.png',
                websiteFavicon: 'https://files.catbox.moe/8u328u.png',
                isMaintenance: false,
                maintenanceMessage: 'Website sedang maintenance.'
            };
        }

        res.locals.config = settings;

        if (settings.isMaintenance) {
            const isUrlAllowed = req.originalUrl.startsWith('/auth') || req.originalUrl.startsWith('/admin');
            const isAdmin = req.session.user && req.session.user.role === 'admin';

            if (!isUrlAllowed && !isAdmin) {
                return res.render('maintenance', { config: settings });
            }
        }
        next();
    } catch (err) {
        console.error("System Middleware Error:", err.message);
        res.locals.config = { websiteTitle: 'Wanzofc Shop', websiteLogo: '', isMaintenance: false };
        next();
    }
};

module.exports = systemMiddleware;