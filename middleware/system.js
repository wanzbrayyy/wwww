const Setting = require('../models/setting');

const systemMiddleware = async (req, res, next) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) {
            settings = await new Setting().save();
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
        console.error(err);
        next();
    }
};

module.exports = systemMiddleware;