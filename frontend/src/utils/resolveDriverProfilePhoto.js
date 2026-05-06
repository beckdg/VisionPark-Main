/**
 * Picks the profile image to show for the logged-in driver.
 * Never prefers a cached http(s)/blob URL in localStorage over the server,
 * so another account's leftover "vp_driver_photo" cannot display.
 * In-session camera/gallery data URLs are still allowed before upload.
 */
export function resolveDriverProfilePhoto(authUser, lsPhotoRaw) {
  if (!authUser || authUser.role !== "driver") return null;

  const fromAuth = authUser.avatarUrl || authUser.profileImageUrl || null;
  const ls = lsPhotoRaw != null ? String(lsPhotoRaw).trim() : "";

  if (!ls) return fromAuth || null;
  if (ls.startsWith("data:")) return ls;

  if (fromAuth && ls === fromAuth) return fromAuth;

  if (fromAuth) {
    try {
      localStorage.removeItem("vp_driver_photo");
    } catch {
      /* ignore */
    }
    return fromAuth;
  }

  if (ls.startsWith("http://") || ls.startsWith("https://") || ls.startsWith("blob:")) {
    try {
      localStorage.removeItem("vp_driver_photo");
    } catch {
      /* ignore */
    }
    return null;
  }

  return ls || null;
}
