module.exports = function(req, res, next) {
    if (!req.session.tokens) {
        return res.redirect('/login/redirect');
    }
    next();
};
