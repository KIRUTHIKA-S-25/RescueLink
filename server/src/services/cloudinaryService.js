const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary if environment variables exist
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a local file to Cloudinary.
 * Falls back to local URL if Cloudinary is not configured or throws an error.
 *
 * @param {string} localFilePath - Path to file stored on local disk by multer
 * @param {string} folder - Destination folder on Cloudinary (default: 'rescuelink')
 * @returns {Promise<{ url: string, isCloudinary: boolean }>}
 */
async function uploadToCloudinary(localFilePath, folder = 'rescuelink') {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return { url: null, isCloudinary: false };
  }

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: folder,
      resource_type: 'image',
    });

    // Optionally remove temporary local file once successfully uploaded to cloud
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (_) {}

    return { url: result.secure_url, isCloudinary: true };
  } catch (err) {
    console.warn(`[CloudinaryService] Upload failed (${err.message}). Falling back to local storage.`);
    return { url: null, isCloudinary: false };
  }
}

module.exports = {
  uploadToCloudinary,
  cloudinary,
};
