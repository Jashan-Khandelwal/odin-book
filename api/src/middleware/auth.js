const passport = require("../config/passport");
const { UnauthorizedError } = require("../lib/errors");

// A valid token is required. Attaches req.user, or fails with a 401.
function requireAuth(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return next(new UnauthorizedError());
    req.user = user;
    next();
  })(req, res, next);
}
module.exports = { requireAuth };
