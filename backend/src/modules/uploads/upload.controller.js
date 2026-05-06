const multer = require("multer");
const {
  uploadProfileImage,
  uploadUserProfileImageByActor,
  uploadIncidentEvidence,
  deleteCloudinaryByPublicId,
  IMAGE_MIMES,
  VIDEO_MIMES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} = require("./upload.service");
const { ValidationError } = require("../../common/errors");

const memory = multer.memoryStorage();

const profileUpload = multer({
  storage: memory,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIMES.has(file.mimetype)) {
      return cb(new ValidationError("Profile image must be JPEG, PNG, or WebP."));
    }
    cb(null, true);
  },
});

const incidentUpload = multer({
  storage: memory,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIMES.has(file.mimetype) && !VIDEO_MIMES.has(file.mimetype)) {
      return cb(
        new ValidationError("Evidence must be JPEG, PNG, WebP, MP4, or QuickTime MOV.")
      );
    }
    cb(null, true);
  },
});

const handleMulterError = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new ValidationError("One or more files exceed the maximum allowed size."));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return next(new ValidationError("Too many files attached."));
    }
    return next(new ValidationError(err.message || "Upload failed."));
  }
  return next(err);
};

const uploadProfileImageHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ValidationError('Missing file field "image".'));
    }
    const data = await uploadProfileImage({
      userId: req.user.userId,
      file: req.file,
    });
    return res.status(200).json(data);
  } catch (e) {
    return next(e);
  }
};

const uploadIncidentEvidenceHandler = async (req, res, next) => {
  try {
    const files = (req.files || []).map((f) => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
      size: f.size,
      originalname: f.originalname,
    }));
    const data = await uploadIncidentEvidence({
      user: req.user,
      incidentParam: req.params.incidentId,
      files,
    });
    return res.status(200).json(data);
  } catch (e) {
    return next(e);
  }
};

const uploadUserProfileImageHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ValidationError('Missing file field "image".'));
    }
    const data = await uploadUserProfileImageByActor({
      actor: req.user,
      targetUserId: req.params.userId,
      file: req.file,
    });
    return res.status(200).json(data);
  } catch (e) {
    return next(e);
  }
};

const deleteMediaHandler = async (req, res, next) => {
  try {
    const publicId = req.body?.publicId;
    await deleteCloudinaryByPublicId({ user: req.user, publicId });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return next(e);
  }
};

module.exports = {
  profileUpload,
  incidentUpload,
  handleMulterError,
  uploadProfileImageHandler,
  uploadUserProfileImageHandler,
  uploadIncidentEvidenceHandler,
  deleteMediaHandler,
};
