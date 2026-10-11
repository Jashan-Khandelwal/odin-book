// Recomputes Post.likeCount and Post.commentCount from the rows they count.
// Denormalised values drift — a bug, a manual SQL edit, a half-applied
// migration — so the repair job is part of the design, not an admission.
const prisma = require("../src/db/prisma");

async function main() {
  const [likes, comments] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "Post" p
      SET "likeCount" = COALESCE(c.n, 0)
      FROM (SELECT id FROM "Post") ids
      LEFT JOIN (SELECT "postId", COUNT(*) AS n FROM "Like" GROUP BY "postId") c
        ON c."postId" = ids.id
      WHERE p.id = ids.id AND p."likeCount" <> COALESCE(c.n, 0)`,
    prisma.$executeRaw`
      UPDATE "Post" p
      SET "commentCount" = COALESCE(c.n, 0)
      FROM (SELECT id FROM "Post") ids
      LEFT JOIN (SELECT "postId", COUNT(*) AS n FROM "Comment" GROUP BY "postId") c
        ON c."postId" = ids.id
      WHERE p.id = ids.id AND p."commentCount" <> COALESCE(c.n, 0)`,
  ]);

  console.log(`repaired ${likes} like counts, ${comments} comment counts`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
