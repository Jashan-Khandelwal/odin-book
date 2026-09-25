const prisma = require("../db/prisma");
const { NotFoundError } = require("../lib/errors");

// A post can be seen when its author is public, OR is the viewer, OR has
// accepted the viewer as a follower. A Prisma filter rather than an
// if-statement, so it composes into any query via AND.
function visibleToViewer(viewerId) {
  return {
    OR: [
      { author: { isPrivate: false } },
      { authorId: viewerId },
      {
        author: {
          followers: { some: { followerId: viewerId, status: "ACCEPTED" } },
        },
      },
    ],
  };
}

// Guard for anything that acts ON a post — liking, commenting, listing its
// comments. 404 rather than 403, so we never confirm a post the viewer
// isn't allowed to see.
async function assertPostVisible(postId, viewerId) {
  const post = await prisma.post.findFirst({
    where: { AND: [{ id: postId }, visibleToViewer(viewerId)] },
    select: { id: true, authorId: true },
  });
  if (!post) throw new NotFoundError("Post not found.");
  return post;
}
// Returning the post means callers also know who to notify.


module.exports = { visibleToViewer, assertPostVisible };
