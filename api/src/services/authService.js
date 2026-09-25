const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("node:crypto");

const prisma = require("../db/prisma");
const config = require("../config");
const { userPrivateSelect, pick } = require("../db/selects");
const { ConflictError, UnauthorizedError } = require("../lib/errors");

const SALT_ROUNDS = 10;

// The token carries nothing but the user id. Everything else is looked up
// fresh on each request, so a change to the account takes effect at once.
function issueToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function register({ username, displayName, email, password }) {
  const data = {
    username: username.toLowerCase(),
    displayName: displayName?.trim() || username,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
  };

  try {
    const user = await prisma.user.create({ data, select: userPrivateSelect });
    return { user, token: issueToken(user) };
  } catch (err) {
    // P2002 is Prisma's unique-constraint violation. Letting the database
    // decide means two simultaneous signups can't both pass a check and
    // then both insert.
    if (err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      throw new ConflictError(
        target.includes("username")
          ? "That username is taken."
          : "That email is already registered.",
      );
    }
    throw err;
  }
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // One message for every failure mode, so the response can't be used to
  // find out which email addresses have accounts.
  const invalid = new UnauthorizedError("Invalid email or password.");

  // No passwordHash means a guest or OAuth account — it cannot log in here.
  if (!user || !user.passwordHash) throw invalid;
  if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid;

  return { user: pick(user, userPrivateSelect), token: issueToken(user) };
}

// async function createGuest() {
//   // Random suffix so two guests arriving at the same moment can't collide,
//   // without needing a lookup first.
//   const suffix = randomBytes(4).toString("hex");

//   const user = await prisma.user.create({
//     data: {
//       username: `guest_${suffix}`,
//       displayName: "Guest",
//       email: `guest_${suffix}@guest.odinbook.local`,
//       passwordHash: null, // a guest can never log back in
//       isGuest: true,
//     },
//     select: userPrivateSelect,
//   });

//   return { user, token: issueToken(user) };
// }
async function createGuest() {
  const suffix = randomBytes(4).toString("hex");

  const user = await prisma.user.create({
    data: {
      username: `guest_${suffix}`,
      displayName: "Guest",
      email: `guest_${suffix}@guest.odinbook.local`,
      passwordHash: null,
      isGuest: true,
    },
    select: userPrivateSelect,
  });

  // A guest who follows nobody lands on an empty feed, which reads as a
  // broken app. Follow a few public accounts so there is something to see.
  const suggestions = await prisma.user.findMany({
    where: { isPrivate: false, isGuest: false, id: { not: user.id } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 8,
  });

  if (suggestions.length > 0) {
    await prisma.follow.createMany({
      data: suggestions.map((u) => ({
        followerId: user.id,
        followingId: u.id,
        status: "ACCEPTED",
      })),
      skipDuplicates: true,
    });
  }

  return { user, token: issueToken(user) };
}

module.exports = { register, login, createGuest };
