const authService = require("../services/authService");

async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ user, token });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  res.json({ user, token });
}

async function guest(req, res) {
  const { user, token } = await authService.createGuest();
  res.status(201).json({ user, token });
}

// requireAuth has already loaded and attached the user.
function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, guest, me };
