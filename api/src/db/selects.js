// What any signed-in user may see about ANOTHER user.
const userPublicSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  isPrivate: true,
  createdAt: true,
};

// What you may see about YOUR OWN account. Adds the fields that are yours
// alone. Note that neither shape contains passwordHash.
const userPrivateSelect = {
  ...userPublicSelect,
  email: true,
  isGuest: true,
};

// Reduce a full database row to one of the shapes above. Used when a query
// had to fetch everything — login needs passwordHash for bcrypt — but the
// response must not contain everything.
function pick(row, shape) {
  const out = {};
  for (const key of Object.keys(shape)) out[key] = row[key];
  return out;
}

module.exports = {
  userPublicSelect,
  userPrivateSelect,
  pick,
};
