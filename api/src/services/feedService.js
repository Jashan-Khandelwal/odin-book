const prisma = require("../db/prisma");
const { postSelect } = require("../db/selects");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { attachPostViewerState } = require("./relationship");

// GET /feed
//
// "Posts written by me, or by someone I have an ACCEPTED follow with."
//
// Note there is no separate privacy check. An accepted follow is exactly
// what grants access to a private account's posts, so this filter already
// IS the visibility rule — postService.visibleToViewer would be redundant.
async function getFeed({ viewerId, cursor, limit }) {
  const rows = await prisma.post.findMany({
    where: {
      AND: [
        {
          OR: [
            { authorId: viewerId },
            {
              author: {
                followers: {
                  some: { followerId: viewerId, status: "ACCEPTED" },
                },
              },
            },
          ],
        },
        cursorWhere(cursor),
      ],
    },
    select: postSelect,
    orderBy: cursorOrderBy(),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (p) => ({
    createdAt: p.createdAt,
    id: p.id,
  }));

  return { posts: await attachPostViewerState(page, viewerId), nextCursor };
}

module.exports = { getFeed };
