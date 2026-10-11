-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;


-- Backfill from the data that already exists. Adding a column with a default
-- is cheap; it's this UPDATE that makes the column correct.
UPDATE "Post" p
SET "likeCount" = c.n
FROM (SELECT "postId", COUNT(*) AS n FROM "Like" GROUP BY "postId") c
WHERE p.id = c."postId";

UPDATE "Post" p
SET "commentCount" = c.n
FROM (SELECT "postId", COUNT(*) AS n FROM "Comment" GROUP BY "postId") c
WHERE p.id = c."postId";

-- Turn silent drift into a loud failure. A counter that goes negative means
-- a decrement ran without a matching delete, which is a bug worth crashing on.
ALTER TABLE "Post"
  ADD CONSTRAINT "post_counts_non_negative"
  CHECK ("likeCount" >= 0 AND "commentCount" >= 0);
