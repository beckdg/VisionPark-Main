const cloudinary = require("cloudinary").v2;
const { env } = require("./env");

let configured = false;

const hasCredentials = () =>
  Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

const ensureConfigured = () => {
  if (!hasCredentials()) {
    return false;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
    });
    configured = true;
  }
  return true;
};

const isCloudinaryConfigured = () => {
  ensureConfigured();
  return hasCredentials();
};

module.exports = {
  cloudinary,
  ensureConfigured,
  isCloudinaryConfigured,
};
