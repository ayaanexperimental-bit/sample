"use client";

export type PreparedCoachHeroPhoto = {
  backgroundRemoved: boolean;
  file: File;
  message: string;
  optimized: boolean;
};

type PrepareCoachHeroPhotoOptions = {
  maxBytes: number;
  maxEdge?: number;
};

type DecodedImage = {
  cleanup: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

const DEFAULT_MAX_EDGE = 1800;
const RETRY_MAX_EDGES = [1800, 1500, 1250, 1050, 900];
const MIN_ALPHA = 12;

export async function prepareCoachHeroPhotoForUpload(
  file: File,
  options: PrepareCoachHeroPhotoOptions
): Promise<PreparedCoachHeroPhoto> {
  const decoded = await decodeImageForCanvas(file);

  try {
    const maxEdges = getRetryEdges(options.maxEdge || DEFAULT_MAX_EDGE);
    let lastBlob: Blob | null = null;

    for (const maxEdge of maxEdges) {
      const canvas = renderTransparentCoachPhoto(decoded, maxEdge);
      const blob = await canvasToBlob(canvas, "image/png", 1);
      lastBlob = blob;

      if (blob && blob.size <= options.maxBytes) {
        const transparentFile = new File([blob], replaceFileExtension(file.name, ".png"), {
          lastModified: file.lastModified,
          type: "image/png"
        });

        return {
          backgroundRemoved: true,
          file: transparentFile,
          message: `Background removed and saved as transparent PNG (${formatBytes(blob.size)}).`,
          optimized: true
        };
      }
    }

    if (lastBlob) {
      const transparentFile = new File([lastBlob], replaceFileExtension(file.name, ".png"), {
        lastModified: file.lastModified,
        type: "image/png"
      });

      return {
        backgroundRemoved: true,
        file: transparentFile,
        message:
          "Background removed, but the PNG is still large. Uploading the smallest transparent version available.",
        optimized: true
      };
    }

    return {
      backgroundRemoved: false,
      file,
      message: "Could not create a transparent PNG. Saving the original photo.",
      optimized: false
    };
  } finally {
    decoded.cleanup();
  }
}

function renderTransparentCoachPhoto(decoded: DecodedImage, maxEdge: number) {
  const largestEdge = Math.max(decoded.width, decoded.height);
  const scale = largestEdge > maxEdge ? maxEdge / largestEdge : 1;
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true
  });
  if (!context) throw new Error("Canvas is unavailable.");

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  applyBackgroundMatte(image);
  context.putImageData(image, 0, 0);

  return canvas;
}

function applyBackgroundMatte(image: ImageData) {
  const { data, height, width } = image;
  const background = detectDominantEdgeColor(data, width, height);
  const threshold = detectBackgroundThreshold(data, width, height, background);
  const mask = floodFillBackground(data, width, height, background, threshold);
  const softened = softenMaskEdges(mask, width, height);

  for (let index = 0; index < mask.length; index += 1) {
    const dataIndex = index * 4;
    if (mask[index]) {
      data[dataIndex + 3] = 0;
      continue;
    }

    const edgeStrength = softened[index];
    if (!edgeStrength) continue;

    const distance = colorDistance(
      data[dataIndex],
      data[dataIndex + 1],
      data[dataIndex + 2],
      background.r,
      background.g,
      background.b
    );
    const closeToBackground = Math.max(0, 1 - distance / (threshold * 1.35));
    const alphaDrop = Math.round(150 * edgeStrength * closeToBackground);
    data[dataIndex + 3] = Math.max(MIN_ALPHA, data[dataIndex + 3] - alphaDrop);
  }
}

function floodFillBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: RgbColor,
  threshold: number
) {
  const total = width * height;
  const mask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let read = 0;
  let write = 0;

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (mask[index]) return;
    if (!isBackgroundCandidate(data, index, background, threshold)) return;

    mask[index] = 1;
    queue[write] = index;
    write += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (read < write) {
    const index = queue[read];
    read += 1;

    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return mask;
}

function softenMaskEdges(mask: Uint8Array, width: number, height: number) {
  const softened = new Float32Array(mask.length);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index]) continue;

      let nearby = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (mask[(y + offsetY) * width + x + offsetX]) nearby += 1;
        }
      }

      softened[index] = nearby / 8;
    }
  }

  return softened;
}

function isBackgroundCandidate(
  data: Uint8ClampedArray,
  pixelIndex: number,
  background: RgbColor,
  threshold: number
) {
  const index = pixelIndex * 4;
  const alpha = data[index + 3];
  if (alpha < 24) return true;

  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const distance = colorDistance(r, g, b, background.r, background.g, background.b);
  if (distance <= threshold) return true;

  const saturation = getSaturation(r, g, b);
  const luminanceGap = Math.abs(getLuminance(r, g, b) - getLuminance(background.r, background.g, background.b));
  return saturation < 0.18 && luminanceGap <= threshold * 0.72 && distance <= threshold * 1.32;
}

function detectDominantEdgeColor(data: Uint8ClampedArray, width: number, height: number): RgbColor {
  const samples = collectEdgeSamples(data, width, height);
  if (!samples.length) return { b: 255, g: 255, r: 255 };

  const buckets = new Map<string, { b: number; count: number; g: number; r: number }>();
  for (const sample of samples) {
    const key = `${Math.round(sample.r / 18)}-${Math.round(sample.g / 18)}-${Math.round(sample.b / 18)}`;
    const bucket = buckets.get(key) || { b: 0, count: 0, g: 0, r: 0 };
    bucket.count += 1;
    bucket.r += sample.r;
    bucket.g += sample.g;
    bucket.b += sample.b;
    buckets.set(key, bucket);
  }

  let dominant = buckets.values().next().value as
    | { b: number; count: number; g: number; r: number }
    | undefined;
  for (const bucket of buckets.values()) {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  }

  if (!dominant) return samples[0];
  return {
    b: Math.round(dominant.b / dominant.count),
    g: Math.round(dominant.g / dominant.count),
    r: Math.round(dominant.r / dominant.count)
  };
}

function detectBackgroundThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: RgbColor
) {
  const samples = collectEdgeSamples(data, width, height);
  if (!samples.length) return 48;

  const distances = samples.map((sample) =>
    colorDistance(sample.r, sample.g, sample.b, background.r, background.g, background.b)
  );
  const mean = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  const variance =
    distances.reduce((sum, distance) => sum + Math.pow(distance - mean, 2), 0) / distances.length;
  const standardDeviation = Math.sqrt(variance);

  return clamp(Math.round(mean + standardDeviation * 1.7 + 24), 42, 92);
}

function collectEdgeSamples(data: Uint8ClampedArray, width: number, height: number) {
  const samples: RgbColor[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 120));
  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] < 24) return;
    samples.push({
      b: data[index + 2],
      g: data[index + 1],
      r: data[index]
    });
  };

  for (let x = 0; x < width; x += step) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    add(0, y);
    add(width - 1, y);
  }

  return samples;
}

async function decodeImageForCanvas(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        cleanup: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width
      };
    } catch {
      return loadImageElement(file);
    }
  }

  return loadImageElement(file);
}

function loadImageElement(file: File) {
  return new Promise<DecodedImage>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      resolve({
        cleanup: () => URL.revokeObjectURL(objectUrl),
        height: image.naturalHeight || image.height,
        source: image,
        width: image.naturalWidth || image.width
      });
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be decoded."));
    });
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, contentType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, contentType, quality);
  });
}

function getRetryEdges(maxEdge: number) {
  return Array.from(new Set([maxEdge, ...RETRY_MAX_EDGES.filter((edge) => edge < maxEdge)]));
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const redMean = (r1 + r2) / 2;
  const red = r1 - r2;
  const green = g1 - g2;
  const blue = b1 - b2;
  return Math.sqrt(
    (2 + redMean / 256) * red * red + 4 * green * green + (2 + (255 - redMean) / 256) * blue * blue
  );
}

function getSaturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function getLuminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function replaceFileExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "") || "coach-photo";
  return `${baseName}-transparent${extension}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(2)} MB`;
}

type RgbColor = {
  b: number;
  g: number;
  r: number;
};
