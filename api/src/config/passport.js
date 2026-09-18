const passport = require("passport");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");

const prisma = require("../db/prisma");
const config = require("../config");
const { userPrivateSelect } = require("../db/selects");

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwtSecret,
    },
    async (payload, done) => {
      try {
        // The token holds an id and nothing else, so load the user fresh.
        // A deleted account stops working on the very next request.
        const user = await prisma.user.findUnique({
          where: { id: Number(payload.sub) },
          select: userPrivateSelect,
        });
        // `false` means "no user" — an authentication failure, not a crash.
        done(null, user || false);
      } catch (err) {
        done(err);
      }
    },
  ),
);

module.exports = passport;
