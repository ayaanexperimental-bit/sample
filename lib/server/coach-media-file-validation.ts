const IMAGE_SIGNATURE_BYTES = 32;

export async function hasSupportedCoachImageSignature(file: File) {
  if (file.size <= 0) return false;
  const bytes = new Uint8Array(await file.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer());
  if (isJpeg(bytes) || isPng(bytes) || isGif(bytes) || isWebp(bytes) || isBmp(bytes)) {
    return true;
  }
  if (isTiff(bytes)) return true;
  return isSupportedIsoImage(bytes);
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isGif(bytes: Uint8Array) {
  return asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a");
}

function isWebp(bytes: Uint8Array) {
  return asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP");
}

function isBmp(bytes: Uint8Array) {
  return asciiAt(bytes, 0, "BM");
}

function isTiff(bytes: Uint8Array) {
  return (
    (asciiAt(bytes, 0, "II") && bytes[2] === 0x2a && bytes[3] === 0) ||
    (asciiAt(bytes, 0, "MM") && bytes[2] === 0 && bytes[3] === 0x2a)
  );
}

function isSupportedIsoImage(bytes: Uint8Array) {
  if (!asciiAt(bytes, 4, "ftyp")) return false;
  const brand = asciiSlice(bytes, 8, 4);
  return new Set([
    "avif",
    "avis",
    "heic",
    "heix",
    "heim",
    "heis",
    "hevc",
    "hevx",
    "mif1",
    "msf1",
  ]).has(brand);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string) {
  return (
    bytes.length >= offset + value.length &&
    Array.from(value).every(
      (character, index) => bytes[offset + index] === character.charCodeAt(0)
    )
  );
}

function asciiSlice(bytes: Uint8Array, offset: number, length: number) {
  return Array.from(bytes.slice(offset, offset + length))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}
