import { isIP } from 'node:net';

export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return (req.ip || '').replace('::ffff:', '');
};

const normalizeIp = (value) => String(value || '')
  .trim()
  .replace(/^\[|\]$/g, '')
  .replace(/^::ffff:/i, '')
  .split('%')[0]
  .toLowerCase();

const ipv4TailToHextets = (value) => {
  const octets = value.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return [((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16)];
};

const ipv6ToBigInt = (input) => {
  let value = normalizeIp(input);
  const tail = value.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (tail) {
    const hextets = ipv4TailToHextets(tail);
    if (!hextets) return null;
    value = `${value.slice(0, -tail.length)}${hextets.join(':')}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.reduce((total, part) => (total << 16n) + BigInt(parseInt(part, 16)), 0n);
};

const ipToBigInt = (value) => {
  const normalized = normalizeIp(value);
  const version = isIP(normalized);
  if (version === 4) {
    return { version, bits: 32, value: normalized.split('.').reduce((total, octet) => (total << 8n) + BigInt(octet), 0n) };
  }
  if (version === 6) return { version, bits: 128, value: ipv6ToBigInt(normalized) };
  return null;
};

export const isValidIpRule = (rule) => {
  const [address, prefixText, ...rest] = String(rule || '').trim().split('/');
  if (rest.length) return false;
  const parsed = ipToBigInt(address);
  if (!parsed) return false;
  if (prefixText === undefined) return true;
  const prefix = Number(prefixText);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= parsed.bits;
};

export const isAllowedIp = (ip, allowedIps = []) => {
  const client = ipToBigInt(ip);
  if (!client) return false;
  return allowedIps.some((rule) => {
    if (!isValidIpRule(rule)) return false;
    const [address, prefixText] = String(rule).trim().split('/');
    const network = ipToBigInt(address);
    if (!network || network.version !== client.version) return false;
    const prefix = prefixText === undefined ? network.bits : Number(prefixText);
    const shift = BigInt(network.bits - prefix);
    return (client.value >> shift) === (network.value >> shift);
  });
};
