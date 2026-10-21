const crypto = require('crypto');

const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function createId(size = 12) {
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let index = 0; index < size; index += 1) {
    id += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return id;
}

function tokensMatch(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  createId,
  tokensMatch,
};
