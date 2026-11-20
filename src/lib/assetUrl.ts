/**
 * Resolves static asset URLs so they work both at domain root ("/")
 * and under a GitHub Pages subpath (e.g. "/fortuna-studio/").
 * Leaves data:, blob:, http://, and https:// URLs untouched.
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }

  const normalized = url.startsWith('/src/assets/images/')
    ? url.replace('/src/assets/images/', '/assets/images/')
    : url;

  const baseRaw =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';
  const base = baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`;

  if (normalized.startsWith('/assets/')) {
    return `${base}${normalized.slice(1)}`;
  }
  if (normalized.startsWith('assets/')) {
    return `${base}${normalized}`;
  }

  return normalized;
}

/**
 * Strips any GitHub Pages base-path prefix before saving to IndexedDB/Firestore,
 * keeping stored asset paths portable across localhost, AI Studio, and GitHub Pages.
 */
export function canonicalizeAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }
  if (url.startsWith('/src/assets/images/')) {
    return url.replace('/src/assets/images/', '/assets/images/');
  }
  const idx = url.indexOf('/assets/');
  if (idx >= 0) {
    return url.slice(idx);
  }
  if (url.startsWith('assets/')) {
    return `/${url}`;
  }
  return url;
}
