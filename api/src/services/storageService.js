const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { v2: cloudinary } = require("cloudinary");

const config = require("../config");
const logger = require("../lib/logger");

// Reads CLOUDINARY_URL from the environment automatically.
// secure: true → https URLs.
if (config.uploadsEnabled) cloudinary.config({ secure: true });

// The ONLY module that knows images live on Cloudinary. Everything else
// calls these two functions, so swapping to S3 or Supabase is one file.
function saveImage(buffer, { folder, transformation }) {
  const publicId = `odinbook/${folder}/${crypto.randomUUID()}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "image", public_id: publicId, transformation },
      (err, result) => {
        if (err) return reject(err);
        // The URL is what we show; the public id is what lets us delete it.
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    // multer handed us a buffer; Cloudinary wants a stream.
    Readable.from(buffer).pipe(stream);
  });
}

// Square, centred on a face if Cloudinary finds one.
const saveAvatar = (buffer) =>
  saveImage(buffer, {
    folder: "avatars",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
    ],
  });

// "limit" only shrinks — a small image is left alone rather than upscaled.
const savePostImage = (buffer) =>
  saveImage(buffer, {
    folder: "posts",
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  });

// Best-effort. A failed cleanup must never fail the user's request — an
// orphaned file costs a few kilobytes; a 500 costs them their post.
async function removeImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    logger.warn({ err, publicId }, "failed to delete image from cloudinary");
  }
}

module.exports = { saveAvatar, savePostImage, removeImage };
