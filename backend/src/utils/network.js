export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return (req.ip || '').replace('::ffff:', '');
};

export const isAllowedIp = (ip, allowedIps = []) => allowedIps.includes(ip);
