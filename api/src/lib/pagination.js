const { BadRequestError } = require("./errors");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw) {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw new BadRequestError(
      `limit must be an integer between 1 and ${MAX_LIMIT}.`,
    );
  }
  return n;
}

// A cursor is the sort key of the last row on the previous page, base64
// encoded so clients treat it as an opaque token rather than something
// to build themselves.
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestError("Invalid cursor.");
  }
}

// "Everything strictly after the cursor", for a list sorted newest-first.
// Postgres can express this as ("createdAt", id) < ($1, $2); Prisma can't,
// so we spell out the same comparison:
//   older than the cursor, OR the same instant but a lower tiebreaker.

// "Everything strictly after the cursor." Default is newest-first; pass
// "asc" for lists that read oldest-first, like comments.
function cursorWhere(cursor, tieField = "id", direction = "desc") {
  if (!cursor) return {};
  const at = new Date(cursor.createdAt);
  const op = direction === "asc" ? "gt" : "lt";
  return {
    OR: [
      { createdAt: { [op]: at } },
      { createdAt: at, [tieField]: { [op]: cursor.id } },
    ],
  };
}

// Must always match cursorWhere — same fields, same direction.
function cursorOrderBy(tieField = "id", direction = "desc") {
  return [{ createdAt: direction }, { [tieField]: direction }];
}

// Queries ask for limit + 1 rows. If the extra one came back there is
// another page: drop it, and build the next cursor from the last row we
// are actually returning.
function buildPage(rows, limit, toCursor) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(toCursor(page.at(-1))) : null;
  return { page, nextCursor };
}

module.exports = {
  parseLimit,
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorOrderBy,
  buildPage,
};
