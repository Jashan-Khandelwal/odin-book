const multer = require("multer");
const { BadRequestError, AppError } = require("./errors");
const config = require("../config");

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// memoryStorage: the file never touches this server's disk. It arrives as a
// buffer and goes straight back out to Cloudinary. Safe because the size
// limit below bounds how much memory one request can hold.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new BadRequestError("Only JPEG, PNG, GIF and WebP images are allowed."));
  },
});

// Wraps multer so its errors arrive in our envelope instead of as a 500.
function singleImage(field, { required = false } = {}) {
  return (req, res, next) => {
    multerUpload.single(field)(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new BadRequestError("That image is larger than 5 MB."));
        }
        return next(err);
      }

      if (required && !req.file) {
        return next(
          new BadRequestError(`An image is required in the "${field}" field.`),
        );
      }

      if (req.file && !config.uploadsEnabled) {
        return next(
          new AppError(503, "Image uploads are not configured on this server."),
        );
      }

      next();
    });
  };
}

module.exports = { singleImage, MAX_BYTES };
