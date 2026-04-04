export const pfpSrc = (pfpName) =>
  new URL(`../../../assets/pfp/${pfpName || "avatar"}.jpeg`, import.meta.url).href;