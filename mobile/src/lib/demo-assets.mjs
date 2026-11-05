const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeDemoFile(value) {
  if (typeof value !== 'string' || value.length > 2_666_668 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid sample file.');
  const bytes = new Uint8Array(value.length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0));
  let at = 0;
  for (let i = 0; i < value.length; i += 4) {
    const n = (alphabet.indexOf(value[i]) << 18) | (alphabet.indexOf(value[i + 1]) << 12) | ((alphabet.indexOf(value[i + 2]) & 63) << 6) | (alphabet.indexOf(value[i + 3]) & 63);
    if (at < bytes.length) bytes[at++] = n >> 16 & 255;
    if (at < bytes.length) bytes[at++] = n >> 8 & 255;
    if (at < bytes.length) bytes[at++] = n & 255;
  }
  return bytes;
}
export function encodeDemoFile(bytes) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    value += alphabet[n >> 18 & 63] + alphabet[n >> 12 & 63] + (i + 1 < bytes.length ? alphabet[n >> 6 & 63] : '=') + (i + 2 < bytes.length ? alphabet[n & 63] : '=');
  }
  return value;
}
export function sampleFile(body) {
  const bytes = decodeDemoFile(body.data), ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  const valid = body.mime === 'application/pdf' ? ascii(0, 5) === '%PDF-' : body.mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : body.mime === 'image/png' ? Array.from(bytes.slice(0, 8)).join() === '137,80,78,71,13,10,26,10' : body.mime === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
  if (!valid || !bytes.length || bytes.length > 2_000_000) throw new Error('Choose a JPG, PNG, WebP or PDF under 2 MB with matching file content.');
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(body.id)) throw new Error('Invalid sample file ID.');
  const name = String(body.name || '').trim().replace(/[\\/\r\n]/g, '_').slice(0, 120);
  if (!name) throw new Error('Enter a filename.');
  return { id: body.id, name, mime: body.mime, size: bytes.length };
}
