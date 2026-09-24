const prisma = require("../db/prisma");
const { userPublicSelect } = require("../db/selects");
const {
  badRequestError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require("../lib/errors");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { attachViewerStatus } = require("./relationship");
const { notify, withdraw } = require("./notificationService");

// Every route here names the other person by username, so this runs first.
async function findByUsername(username) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true, isPrivate: true },
  });
  if (!user) throw new NotFoundError("User not found.");
  return user;
}

// A private account's follower and following lists are visible only to the
// account itself and to people it has accepted.
async function assertCanViewGraph(viewerId, target) {
  if (!target.isPrivate || target.id === viewerId) return;

  const link = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: target.id,
      },
    },
    select: { status: true },
  });

  if (link?.status !== "ACCEPTED") {
    throw new ForbiddenError("This account is private.");
  }
}

// PUT /users/:username/follow
async function follow({ viewerId, username }) {
  const target = await findByUsername(username);

  if (target.id === viewerId) {
    throw new BadRequestError("You cannot follow yourself.");
  }

  const status = target.isPrivate ? "PENDING" : "ACCEPTED";

  // createMany with skipDuplicates tells us whether a row was actually
  // inserted — `count` is 1 for a new follow, 0 if it already existed.
  // upsert can't tell us that, and we only want to notify on a NEW follow.
  const inserted = await prisma.follow.createMany({
    data: [{ followerId: viewerId, followingId: target.id, status }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    // Already following or already requested — report the real status and
    // send nothing.
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: target.id,
        },
      },
      select: { status: true },
    });
    return { status: existing.status };
  }

  await notify({
    recipientId: target.id,
    actorId: viewerId,
    type: status === "PENDING" ? "FOLLOW_REQUEST" : "NEW_FOLLOWER",
  });

  return { status };
}
// async function follow({ viewerId, username }) {
//   const target = await findByUsername(username);

//   // The CHECK constraint would also catch this, but a clean 400 beats a
//   // database exception.
//   if (target.id === viewerId) {
//     throw new BadRequestError("you cannot follow yourself");
//   }

//   // A private account has to approve. A public one does not.
//   const status = target.isPrivate ? "PENDING" : "ACCEPTED";

//   const row = await prisma.follow.upsert({
//     where: {
//       followerId_followingId: {
//         followerId: viewerId,
//         followingId: target.id,
//       },
//     },
//     create: { followerId: viewerId, followingId: target.id, status },
//     // Already following: change nothing. An empty update is what makes
//     // this idempotent, and it stops a second PUT from knocking an
//     // ACCEPTED follow back to PENDING.
//     update: {},
//     select: { status: true },
//   });
//   return { status: row.status };
// }

async function unfollow({ viewerId, username }) {
  const target = await findByUsername(username);

  await prisma.follow.deleteMany({
    where: { followerId: viewerId, followingId: target.id },
  });

  // Cancelling a request should take the request notification with it.
  await withdraw({
    recipientId: target.id,
    actorId: viewerId,
    type: "FOLLOW_REQUEST",
  });
}
// async function unfollow({ viewerId, username }) {
//   const target = await findByUsername(username);

//   await prisma.follow.findMany({
//     where: { followerId: viewerId, followingId: target.id },
//   });
// }

// GET /follow-requests — people waiting for me to approve them.
async function listRequests({ viewerId, cursor, limit }) {
  const rows = await prisma.follow.findMany({
    where: {
      AND: [
        { followingId: viewerId, status: "PENDING" },
        cursorWhere(cursor, "followerId"),
      ],
    },
    select: { createdAt: true, follower: { select: userPublicSelect } },
    orderBy: cursorOrderBy("followerId"),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (r) => ({
    createdAt: r.createdAt,
    id: r.follower.id,
  }));

  return { users: page.map((r) => r.follower), nextCursor };
}

// POST /follow-requests/:username/accept
async function acceptRequest({ viewerId, username }) {
  const requester = await findByUsername(username);

  const result = await prisma.follow.updateMany({
    where: {
      followerId: requester.id,
      followingId: viewerId,
      status: "PENDING",
    },
    data: { status: "ACCEPTED" },
  });

  if (result.count === 0) {
    throw new NotFoundError("No pending follow request from that user.");
  }

  // The notification goes the other way: tell the requester they're in.
  await notify({
    recipientId: requester.id,
    actorId: viewerId,
    type: "FOLLOW_ACCEPTED",
  });

  return { status: "ACCEPTED" };
}
// async function acceptRequest({ viewerId, username }) {
//   const requester = await findByUsername(username);

//   // updateMany, not update: the filter includes status, so this ONLY ever
//   // moves a row from PENDING to ACCEPTED. It returns how many rows changed.
//   const result = await prisma.follow.updateMany({
//     where: {
//       followerId: requester.id,
//       followingId: viewerId,
//       status: "PENDING",
//     },
//     data: { status: "ACCEPTED" },
//   });

//   if (result.count === 0) {
//     throw new NotFoundError("no pending follow requrest from that user.");
//   }

//   return { status: "ACCEPTED" };
// }

// POST /follow-requests/:username/reject
async function rejectRequest({ viewerId, username }) {
  const requester = await findByUsername(username);

  const result = await prisma.follow.deleteMany({
    where: {
      followerId: requester.id,
      followingId: viewerId,
      status: "PENDING",
    },
  });
  if (result.count === 0) {
    throw new NotFoundError("No pending follow request from that user.");
  }
}

// GET /users/:username/followers and /following are the same query read in
// opposite directions, so they share one function with three knobs.
async function listGraph({ viewerId, username, direction, cursor, limit }) {
  const target = await findByUsername(username);
  await assertCanViewGraph(viewerId, target);

  const isFollowers = direction === "followers";

  // followers → rows where the target is being followed; return the follower.
  // following → rows where the target is the follower; return the followed.
  const anchor = isFollowers
    ? { followingId: target.id }
    : { followerId: target.id };
  const tieField = isFollowers ? "followerId" : "followingId";
  const relation = isFollowers ? "follower" : "following";

  const rows = await prisma.follow.findMany({
    where: {
      AND: [{ ...anchor, status: "ACCEPTED" }, cursorWhere(cursor, tieField)],
    },
    select: { createdAt: true, [relation]: { select: userPublicSelect } },
    orderBy: cursorOrderBy(tieField),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (r) => ({
    createdAt: r.createdAt,
    id: r[relation].id,
  }));

  const users = await attachViewerStatus(
    page.map((r) => r[relation]),
    viewerId,
  );

  return { users, nextCursor };
}

module.exports={
    follow,
    unfollow,
    listRequests,
    acceptRequest,
    rejectRequest,
    listGraph,
};