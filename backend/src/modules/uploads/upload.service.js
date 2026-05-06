const mongoose = require("mongoose");
const { cloudinary, ensureConfigured, isCloudinaryConfigured } = require("../../config/cloudinary");
const { User } = require("../users/models/user.model");
const { AttendantIncident } = require("../attendantIncidents/models/attendant-incident.model");
const { Incident } = require("../operations/models/incident.model");
const { NotFoundError, ValidationError, ForbiddenError } = require("../../common/errors");

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime"]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const assertCloudinary = () => {
  ensureConfigured();
  if (!isCloudinaryConfigured()) {
    throw new ValidationError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }
};

const classifyKind = (mimetype) => {
  if (IMAGE_MIMES.has(mimetype)) return "image";
  if (VIDEO_MIMES.has(mimetype)) return "video";
  return null;
};

const maxBytesForKind = (kind) => (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES);

const uploadBuffer = (buffer, { folder, publicId, resourceType }) =>
  new Promise((resolve, reject) => {
    const opts = {
      folder,
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: resourceType === "video" ? "video" : "image",
    };
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      if (!result?.secure_url || !result?.public_id) {
        return reject(new ValidationError("Cloudinary upload returned an unexpected response."));
      }
      resolve(result);
    });
    stream.end(buffer);
  });

const profileDisplayUrl = (publicId) => {
  ensureConfigured();
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 300, height: 300, crop: "fill", gravity: "face" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
};

const destroyCloudinaryAsset = async (publicId, resourceTypeHint) => {
  if (!publicId) return;
  ensureConfigured();
  const tryDestroy = async (resourceType) =>
    cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: resourceType });

  if (resourceTypeHint === "video") {
    await tryDestroy("video");
    return;
  }
  if (resourceTypeHint === "image") {
    await tryDestroy("image");
    return;
  }
  const img = await tryDestroy("image");
  if (img?.result === "not found") {
    await tryDestroy("video");
  }
};

const resolveAttendantOrOpsIncident = async (incidentParam) => {
  const raw = String(incidentParam || "").trim();
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const attendantDoc = await AttendantIncident.findById(raw).lean();
    if (attendantDoc) return { scope: "attendant", doc: attendantDoc };
    const opDoc = await Incident.findById(raw).lean();
    if (opDoc) return { scope: "operations", doc: opDoc };
    return null;
  }

  const byCode = await AttendantIncident.findOne({ incidentCode: raw }).lean();
  if (byCode) return { scope: "attendant", doc: byCode };
  return null;
};

const canUploadEvidence = (user, scope, doc) => {
  if (user.role === "admin") return true;
  if (user.role !== "attendant") return false;
  const uid = String(user.userId);
  if (scope === "attendant") {
    return String(doc.attendantId) === uid || String(doc.createdById) === uid;
  }
  if (scope === "operations") {
    if (doc.createdByType !== "attendant" || !doc.createdById) return false;
    return String(doc.createdById) === uid;
  }
  return false;
};

const findOperationsIncidentForAttendantRow = async (attendantDoc) => {
  const code = attendantDoc?.incidentCode;
  if (!code) return null;
  return Incident.findOne({ tags: code }).sort({ createdAt: -1 }).select("_id").lean();
};

const assertEvidenceFile = (file) => {
  if (!file?.buffer || !file.mimetype) {
    throw new ValidationError("Each file must include buffer and MIME type.");
  }
  const kind = classifyKind(file.mimetype);
  if (!kind) {
    throw new ValidationError(
      "Unsupported file type. Allowed: images (JPEG, PNG, WebP) and videos (MP4, MOV)."
    );
  }
  const max = maxBytesForKind(kind);
  if (file.size > max) {
    throw new ValidationError(
      kind === "video"
        ? "Each video must be 50MB or smaller."
        : "Each image must be 10MB or smaller."
    );
  }
  return kind;
};

async function uploadProfileImage({ userId, file }) {
  assertCloudinary();
  if (!file?.buffer || !file.mimetype) {
    throw new ValidationError("Image file is required.");
  }
  const kind = classifyKind(file.mimetype);
  if (kind !== "image") {
    throw new ValidationError("Profile image must be JPEG, PNG, or WebP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError("Profile image must be 10MB or smaller.");
  }

  const user = await User.findById(userId).select("profileImagePublicId");
  if (!user) throw new NotFoundError("User not found.");

  const folder = `visionpark/profiles/${userId}`;
  const publicId = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  if (user.profileImagePublicId) {
    await destroyCloudinaryAsset(user.profileImagePublicId, "image");
  }

  const uploaded = await uploadBuffer(file.buffer, {
    folder,
    publicId,
    resourceType: "image",
  });

  const displayUrl = profileDisplayUrl(uploaded.public_id);

  await User.findByIdAndUpdate(userId, {
    profileImageUrl: displayUrl,
    profileImagePublicId: uploaded.public_id,
    avatarUrl: displayUrl,
  });

  return { url: displayUrl, publicId: uploaded.public_id };
}

async function uploadUserProfileImageByActor({ actor, targetUserId, file }) {
  if (!actor || !actor.userId || !actor.role) {
    throw new ForbiddenError("Authentication required.");
  }
  const target = await User.findById(targetUserId).select("role attendant.ownerId");
  if (!target) {
    throw new NotFoundError("User not found.");
  }

  const actorId = String(actor.userId);
  const targetId = String(targetUserId);

  if (actor.role === "admin") {
    return uploadProfileImage({ userId: targetId, file });
  }
  if (actor.role === "owner") {
    if (target.role !== "attendant") {
      throw new ForbiddenError("Owners may only upload profile images for attendants.");
    }
    if (String(target?.attendant?.ownerId || "") !== actorId) {
      throw new ForbiddenError("You can only upload profile images for your attendants.");
    }
    return uploadProfileImage({ userId: targetId, file });
  }
  if (actorId === targetId) {
    return uploadProfileImage({ userId: targetId, file });
  }

  throw new ForbiddenError("You are not allowed to upload this user's profile image.");
}

async function uploadIncidentEvidence({ user, incidentParam, files }) {
  assertCloudinary();
  const resolved = await resolveAttendantOrOpsIncident(incidentParam);
  if (!resolved) throw new NotFoundError("Incident not found.");
  if (!canUploadEvidence(user, resolved.scope, resolved.doc)) {
    throw new ForbiddenError("You cannot upload evidence for this incident.");
  }

  const list = Array.isArray(files) ? files : [];
  if (!list.length) {
    throw new ValidationError('At least one file is required in the "files" field.');
  }
  if (list.length > 5) {
    throw new ValidationError("A maximum of 5 files is allowed per request.");
  }

  const folderKey =
    resolved.scope === "attendant"
      ? String(resolved.doc._id)
      : String(resolved.doc._id);
  const folder = `visionpark/incidents/${folderKey}`;

  const uploaded = [];

  for (const file of list) {
    const kind = assertEvidenceFile(file);
    const publicId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const result = await uploadBuffer(file.buffer, {
      folder,
      publicId,
      resourceType: kind === "video" ? "video" : "image",
    });

    const deliveryUrl =
      kind === "video"
        ? result.secure_url
        : cloudinary.url(result.public_id, {
            secure: true,
            transformation: [{ fetch_format: "auto", quality: "auto" }],
          });

    const mediaType = kind === "video" ? "video" : "photo";
    const evidenceType = kind === "video" ? "video" : "image";

    uploaded.push({
      url: deliveryUrl,
      publicId: result.public_id,
      type: evidenceType,
      mediaType,
    });
  }

  const evidenceForIncident = uploaded.map((u) => ({
    url: u.url,
    publicId: u.publicId,
    type: u.type,
    source: "cloudinary",
    metadata: {},
  }));

  if (resolved.scope === "attendant") {
    const mediaPayload = uploaded.map((u) => ({
      type: u.mediaType,
      name: u.publicId,
      data: null,
      url: u.url,
      publicId: u.publicId,
    }));

    await AttendantIncident.updateOne(
      { _id: resolved.doc._id },
      { $push: { media: { $each: mediaPayload } } }
    );

    const op = await findOperationsIncidentForAttendantRow(resolved.doc);
    if (op?._id) {
      await Incident.updateOne({ _id: op._id }, { $push: { evidence: { $each: evidenceForIncident } } });
    }
  } else {
    await Incident.updateOne({ _id: resolved.doc._id }, { $push: { evidence: { $each: evidenceForIncident } } });
  }

  return { uploaded };
}

async function deleteCloudinaryByPublicId({ user, publicId }) {
  assertCloudinary();
  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    throw new ValidationError("publicId is required.");
  }
  const pid = publicId.trim();

  if (user.role === "admin") {
    await destroyCloudinaryAsset(pid);
    return { ok: true };
  }

  const profileUser = await User.findById(user.userId).select("profileImagePublicId").lean();
  if (profileUser?.profileImagePublicId && profileUser.profileImagePublicId === pid) {
    await destroyCloudinaryAsset(pid, "image");
    await User.findByIdAndUpdate(user.userId, {
      $unset: { profileImagePublicId: 1, profileImageUrl: 1 },
      avatarUrl: null,
    });
    return { ok: true };
  }

  const prefix = `visionpark/profiles/${user.userId}/`;
  if (pid.startsWith(prefix)) {
    await destroyCloudinaryAsset(pid, "image");
    await User.findByIdAndUpdate(user.userId, {
      $unset: { profileImagePublicId: 1, profileImageUrl: 1 },
      avatarUrl: null,
    });
    return { ok: true };
  }

  const onAttendantIncident = await AttendantIncident.findOne({ "media.publicId": pid })
    .select("_id attendantId createdById")
    .lean();

  if (
    onAttendantIncident &&
    canUploadEvidence(user, "attendant", onAttendantIncident)
  ) {
    await destroyCloudinaryAsset(pid);
    await AttendantIncident.updateOne(
      { _id: onAttendantIncident._id },
      { $pull: { media: { publicId: pid } } }
    );
    await Incident.updateMany(
      { "evidence.publicId": pid },
      { $pull: { evidence: { publicId: pid } } }
    );
    return { ok: true };
  }

  const opIncident = await Incident.findOne({ "evidence.publicId": pid })
    .select("_id createdById createdByType")
    .lean();
  if (opIncident && canUploadEvidence(user, "operations", opIncident)) {
    await destroyCloudinaryAsset(pid);
    await Incident.updateOne({ _id: opIncident._id }, { $pull: { evidence: { publicId: pid } } });
    return { ok: true };
  }

  throw new ForbiddenError("You are not allowed to delete this asset.");
}

module.exports = {
  uploadProfileImage,
  uploadUserProfileImageByActor,
  uploadIncidentEvidence,
  deleteCloudinaryByPublicId,
  classifyKind,
  IMAGE_MIMES,
  VIDEO_MIMES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
};
