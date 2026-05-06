const express = require("express");
const { authenticate } = require("../auth/auth.middleware");
const {
  profileUpload,
  incidentUpload,
  handleMulterError,
  uploadProfileImageHandler,
  uploadUserProfileImageHandler,
  uploadIncidentEvidenceHandler,
  deleteMediaHandler,
} = require("./upload.controller");

const router = express.Router();

router.post(
  "/profile-image",
  authenticate,
  profileUpload.single("image"),
  handleMulterError,
  uploadProfileImageHandler
);

router.post(
  "/users/:userId/profile-image",
  authenticate,
  profileUpload.single("image"),
  handleMulterError,
  uploadUserProfileImageHandler
);

router.post(
  "/incidents/:incidentId/evidence",
  authenticate,
  incidentUpload.array("files", 5),
  handleMulterError,
  uploadIncidentEvidenceHandler
);

router.delete("/", authenticate, deleteMediaHandler);

module.exports = router;
