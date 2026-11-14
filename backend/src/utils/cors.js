const DEFAULT_ALLOWED_ORIGINS = [
  'https://bowlinestays.com',
  'https://www.bowlinestays.com',
  'https://bowline-omega.vercel.app',
];

const normalizeOrigin = (value) => {
  if (!value) return '';

  try {
    return new URL(String(value).trim()).origin;
  } catch {
    return '';
  }
};

export const createOriginChecker = (configuredOrigins = '') => {
  const allowedOrigins = new Set(
    [...DEFAULT_ALLOWED_ORIGINS, ...String(configuredOrigins).split(',')]
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  return (origin) => {
    // Requests without an Origin header are server-to-server requests, not
    // cross-origin browser requests, so CORS does not need to reject them.
    if (!origin) return true;

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;
    if (allowedOrigins.has(normalizedOrigin)) return true;

    const { hostname } = new URL(normalizedOrigin);

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    return (
      hostname.endsWith('.vercel.app') &&
      (hostname.startsWith('bowline-') || hostname === 'bowline-omega.vercel.app')
    );
  };
};

