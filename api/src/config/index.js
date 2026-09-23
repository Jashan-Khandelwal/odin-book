require("dotenv").config();

// The ONLY module in the codebase that touches process.env.
// If something is missing or malformed, we throw here — at import time,
// before the server can start listening.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, defaultValue) {
  const value = process.env[name];
  return value === undefined || value === "" ? defaultValue : value;
}

const config = {
  env: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "3002")),
  logLevel: optional("LOG_LEVEL", "info"),

  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),

  cloudinaryUrl: optional("CLOUDINARY_URL", null),

  // "a.com, b.com" → ["a.com", "b.com"]
  corsOrigins: optional("CORS_ORIGINS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

config.isProduction = config.env === "production";
config.isTest = config.env === "test";

// Uploads are optional: the API boots and runs fine without Cloudinary,
// and the upload endpoints return a clear 503 instead of crashing.
config.uploadsEnabled = Boolean(config.cloudinaryUrl);


if (!Number.isInteger(config.port) || config.port <= 0) {
  throw new Error(`PORT must be a positive integer, got: ${process.env.PORT}`);
}

// A short secret in development is inconvenient; in production it is a breach.
if (config.isProduction && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}

module.exports = config;
