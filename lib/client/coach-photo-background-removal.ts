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
  onProgress?: (message: string) => void;
};

type DecodedImage = {
  cleanup: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

const DEFAULT_MAX_EDGE = 850;
const RETRY_MAX_EDGES = [850, 700, 600];
const MIN_ALPHA = 12;
const REMBG_MODEL_NAME = "u2netp";
const REMBG_FAST_MODEL_NAME = REMBG_MODEL_NAME;
const REMBG_QUALITY_MODEL_NAME = "silueta-local-chunks";
const REMBG_MODEL_BASE_URL = "/models";
const REMBG_QUALITY_MODEL_PART_URLS = ["/models/silueta.onnx.part1", "/models/silueta.onnx.part2"];
const ORT_WASM_BASE_URL = "/ort/";
const EDGE_ALPHA_CLEANUP_THRESHOLD = 8;
const EDGE_ALPHA_LOW_CONFIDENCE = 34;
const EDGE_OPAQUE_THRESHOLD = 218;
const SUBJECT_CANVAS_PADDING_RATIO = 0.045;
const SUBJECT_BOTTOM_BIAS = 0.6;

type RembgModelName = typeof REMBG_FAST_MODEL_NAME | typeof REMBG_QUALITY_MODEL_NAME;

const rembgSessionPromises = new Map<RembgModelName, Promise<unknown>>();
let siluetaModelObjectUrlPromise: Promise<string> | null = null;
let qualityModelReady = false;
let qualityModelWarmupPromise: Promise<unknown> | null = null;

export async function preloadCoachHeroPhotoBackgroundRemoval() {
  if (typeof window === "undefined") return;

  try {
    if (!qualityModelWarmupPromise) {
      qualityModelWarmupPromise = loadRembgRuntime()
        .then((rembg) => getRembgSession(rembg, REMBG_QUALITY_MODEL_NAME))
        .then((session) => {
          qualityModelReady = true;
          return session;
        })
        .catch((error) => {
          qualityModelReady = false;
          qualityModelWarmupPromise = null;
          throw error;
        });
    }

    await qualityModelWarmupPromise;
  } catch {
    // This only warms the optional high-quality model; upload can still use the fast local model.
  }
}

export async function prepareCoachHeroPhotoForUpload(
  file: File,
  options: PrepareCoachHeroPhotoOptions
): Promise<PreparedCoachHeroPhoto> {
  options.onProgress?.("Creating transparent coach cutout...");

  const rembgFile = await tryCreateRembgCutout(file, options);
  if (rembgFile) {
    return {
      backgroundRemoved: true,
      file: rembgFile,
      message: `Background removed and saved as transparent PNG (${formatBytes(rembgFile.size)}).`,
      optimized: true
    };
  }

  const canvasFile = await tryCreateCanvasCutout(file, options);
  if (canvasFile) {
    return {
      backgroundRemoved: true,
      file: canvasFile,
      message: `Background removed and saved as transparent PNG (${formatBytes(canvasFile.size)}).`,
      optimized: true
    };
  }

  throw new Error(
    "Could not create a transparent cutout. Use a clearer photo with visible subject edges and try again."
  );
}

async function tryCreateRembgCutout(
  file: File,
  options: PrepareCoachHeroPhotoOptions
): Promise<File | null> {
  if (typeof window === "undefined") return null;

  try {
    const resizedFile = await resizeImageForProcessing(file, options.maxEdge || DEFAULT_MAX_EDGE);
    options.onProgress?.("Loading local cutout model...");

    const rembg = await loadRembgRuntime();
    let transparentFile: File | null = null;

    for (const modelName of getRembgModelOrder()) {
      try {
        options.onProgress?.(
          modelName === REMBG_QUALITY_MODEL_NAME
            ? "Loading high-quality local cutout model..."
            : "Using fast local cutout model..."
        );
        const session = await getRembgSession(rembg, modelName);
        options.onProgress?.(
          modelName === REMBG_QUALITY_MODEL_NAME
            ? "Creating high-quality transparent coach cutout..."
            : "Creating transparent coach cutout..."
        );
        const output = await rembg.remove(resizedFile, {
          onProgress: (progress) => {
            if (progress.message) options.onProgress?.(progress.message);
          },
          postProcessMask: true,
          session
        });
        transparentFile = new File([output], replaceFileExtension(file.name, ".png"), {
          lastModified: file.lastModified,
          type: "image/png"
        });
        break;
      } catch {
        if (modelName === REMBG_QUALITY_MODEL_NAME) {
          options.onProgress?.("High-quality model unavailable here. Continuing with fast local model...");
        }
      }
    }

    if (!transparentFile) return null;

    options.onProgress?.("Polishing transparent edges...");
    const polishedFile = await polishTransparentCutout(transparentFile, file.lastModified, options);
    const finalFile = polishedFile || transparentFile;
    if (finalFile.size <= options.maxBytes) return finalFile;
    return await shrinkPngFile(finalFile, file.lastModified, options);
  } catch {
    return null;
  }
}

async function loadRembgRuntime() {
  const [ort, rembg] = await Promise.all([
    import("onnxruntime-web"),
    import("@bunnio/rembg-web")
  ]);
  ort.env.wasm.wasmPaths = ORT_WASM_BASE_URL;
  ort.env.wasm.numThreads = 1;
  rembg.rembgConfig.setBaseUrl(REMBG_MODEL_BASE_URL);

  return rembg;
}

async function getRembgSession(rembg: typeof import("@bunnio/rembg-web"), modelName: RembgModelName) {
  const cachedSession = rembgSessionPromises.get(modelName);
  if (!cachedSession) {
    const nextSession = createRembgSession(rembg, modelName).catch((error) => {
      rembgSessionPromises.delete(modelName);
      throw error;
    });
    rembgSessionPromises.set(modelName, nextSession);
  }

  return rembgSessionPromises.get(modelName) as ReturnType<typeof rembg.newSession>;
}

async function createRembgSession(
  rembg: typeof import("@bunnio/rembg-web"),
  modelName: RembgModelName
) {
  if (modelName === REMBG_QUALITY_MODEL_NAME) {
    const modelPath = await getSiluetaModelObjectUrl();
    return rembg.newSession(
      "u2net_custom",
      {
        inputSize: [320, 320],
        mean: [0.485, 0.456, 0.406],
        modelPath,
        std: [0.229, 0.224, 0.225]
      },
      {
        executionProviders: ["wasm"],
        numThreads: 1
      }
    );
  }

  return rembg.newSession(modelName, undefined, {
    executionProviders: ["wasm"],
    numThreads: 1
  });
}

async function getSiluetaModelObjectUrl() {
  if (!siluetaModelObjectUrlPromise) {
    siluetaModelObjectUrlPromise = downloadSiluetaModelObjectUrl().catch((error) => {
      siluetaModelObjectUrlPromise = null;
      throw error;
    });
  }

  return siluetaModelObjectUrlPromise;
}

async function downloadSiluetaModelObjectUrl() {
  const buffers = await Promise.all(
    REMBG_QUALITY_MODEL_PART_URLS.map(async (url) => {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Could not load high-quality model part (${response.status}).`);
      return response.arrayBuffer();
    })
  );
  const totalBytes = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  if (totalBytes < 40 * 1024 * 1024) {
    throw new Error("High-quality cutout model parts are incomplete.");
  }

  return URL.createObjectURL(new Blob(buffers, { type: "application/octet-stream" }));
}

function getRembgModelOrder(): RembgModelName[] {
  return qualityModelReady
    ? [REMBG_QUALITY_MODEL_NAME, REMBG_FAST_MODEL_NAME]
    : [REMBG_FAST_MODEL_NAME];
}

async function tryCreateCanvasCutout(
  file: File,
  options: PrepareCoachHeroPhotoOptions
): Promise<File | null> {
  const decoded = await decodeImageForCanvas(file);

  try {
    const maxEdges = getRetryEdges(options.maxEdge || DEFAULT_MAX_EDGE);
    let lastBlob: Blob | null = null;

    for (const maxEdge of maxEdges) {
      const canvas = renderTransparentCoachPhoto(decoded, maxEdge);
      const blob = await canvasToBlob(canvas, "image/png", 1);
      lastBlob = blob;

      if (blob && blob.size > 2048 && blob.size <= options.maxBytes) {
        return new File([blob], replaceFileExtension(file.name, ".png"), {
          lastModified: file.lastModified,
          type: "image/png"
        });
      }
    }

    if (lastBlob && lastBlob.size > 2048) {
      return new File([lastBlob], replaceFileExtension(file.name, ".png"), {
        lastModified: file.lastModified,
        type: "image/png"
      });
    }

    return null;
  } finally {
    decoded.cleanup();
  }
}

async function resizeImageForProcessing(file: File, maxEdge: number) {
  const decoded = await decodeImageForCanvas(file);
  try {
    const largestEdge = Math.max(decoded.width, decoded.height);
    if (largestEdge <= maxEdge) return file;

    const scale = maxEdge / largestEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    if (!blob) return file;

    return new File([blob], replaceFileExtension(file.name, ".jpg"), {
      lastModified: file.lastModified,
      type: "image/jpeg"
    });
  } finally {
    decoded.cleanup();
  }
}

async function shrinkPngFile(
  file: File,
  lastModified: number,
  options: PrepareCoachHeroPhotoOptions
) {
  const decoded = await decodeImageForCanvas(file);
  try {
    for (const maxEdge of getRetryEdges(options.maxEdge || DEFAULT_MAX_EDGE)) {
      const largestEdge = Math.max(decoded.width, decoded.height);
      const scale = largestEdge > maxEdge ? maxEdge / largestEdge : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) continue;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, "image/png", 1);
      if (blob && blob.size <= options.maxBytes) {
        return new File([blob], file.name, { lastModified, type: "image/png" });
      }
    }
  } finally {
    decoded.cleanup();
  }

  return null;
}

async function polishTransparentCutout(
  file: File,
  lastModified: number,
  options: PrepareCoachHeroPhotoOptions
) {
  const decoded = await decodeImageForCanvas(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true
    });
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    polishTransparentMatte(image);
    context.putImageData(image, 0, 0);

    const packedCanvas = packTransparentSubject(canvas, image) || canvas;
    const blob = await canvasToBlob(packedCanvas, "image/png", 1);
    if (!blob || blob.size <= 2048) return null;

    const polishedFile = new File([blob], file.name, { lastModified, type: "image/png" });
    if (polishedFile.size <= options.maxBytes) return polishedFile;

    return await shrinkPngFile(polishedFile, lastModified, options);
  } finally {
    decoded.cleanup();
  }
}

function polishTransparentMatte(image: ImageData) {
  const { data, height, width } = image;
  const total = width * height;
  const alpha = new Uint8ClampedArray(total);
  const nextAlpha = new Uint8ClampedArray(total);

  for (let index = 0; index < total; index += 1) {
    const value = data[index * 4 + 3];
    alpha[index] = value < EDGE_ALPHA_CLEANUP_THRESHOLD ? 0 : value;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = alpha[index];
      if (!value) {
        nextAlpha[index] = 0;
        continue;
      }

      const neighborProfile = getAlphaNeighborProfile(alpha, width, height, x, y);
      if (value < EDGE_ALPHA_LOW_CONFIDENCE && neighborProfile.opaqueCount < 2) {
        nextAlpha[index] = 0;
        continue;
      }

      if (!neighborProfile.touchesEdge) {
        nextAlpha[index] = value;
        continue;
      }

      const blurred = getWeightedAlpha(alpha, width, height, x, y);
      nextAlpha[index] = clamp(Math.round(value * 0.64 + blurred * 0.36), 0, 255);
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const dataIndex = index * 4;
      const value = nextAlpha[index];
      data[dataIndex + 3] = value < EDGE_ALPHA_CLEANUP_THRESHOLD ? 0 : value;

      if (value <= EDGE_ALPHA_CLEANUP_THRESHOLD || value >= 246) continue;
      if (!isAlphaEdge(nextAlpha, width, height, x, y)) continue;

      const foreground = sampleNearbyForeground(data, nextAlpha, width, height, x, y);
      if (!foreground) continue;

      const strength = clamp((246 - value) / 246 * 0.72 + 0.08, 0, 0.82);
      data[dataIndex] = Math.round(data[dataIndex] * (1 - strength) + foreground.r * strength);
      data[dataIndex + 1] = Math.round(data[dataIndex + 1] * (1 - strength) + foreground.g * strength);
      data[dataIndex + 2] = Math.round(data[dataIndex + 2] * (1 - strength) + foreground.b * strength);
    }
  }
}

function packTransparentSubject(sourceCanvas: HTMLCanvasElement, image: ImageData) {
  const bounds = getAlphaBounds(image);
  if (!bounds) return null;

  const longestSubjectEdge = Math.max(bounds.width, bounds.height);
  if (longestSubjectEdge < Math.min(sourceCanvas.width, sourceCanvas.height) * 0.12) return null;

  const padding = Math.max(14, Math.round(longestSubjectEdge * SUBJECT_CANVAS_PADDING_RATIO));
  const sourceX = Math.max(0, bounds.x - padding);
  const sourceY = Math.max(0, bounds.y - padding);
  const sourceRight = Math.min(sourceCanvas.width, bounds.x + bounds.width + padding);
  const sourceBottom = Math.min(sourceCanvas.height, bounds.y + bounds.height + padding);
  const sourceWidth = sourceRight - sourceX;
  const sourceHeight = sourceBottom - sourceY;
  const targetSize = Math.max(sourceWidth, sourceHeight);
  const packedCanvas = document.createElement("canvas");
  packedCanvas.width = targetSize;
  packedCanvas.height = targetSize;
  const context = packedCanvas.getContext("2d", { alpha: true });
  if (!context) return null;

  context.clearRect(0, 0, targetSize, targetSize);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const left = Math.round((targetSize - sourceWidth) / 2);
  const top = Math.max(0, Math.round((targetSize - sourceHeight) * SUBJECT_BOTTOM_BIAS));
  context.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    left,
    top,
    sourceWidth,
    sourceHeight
  );

  return packedCanvas;
}

function getAlphaBounds(image: ImageData) {
  const { data, height, width } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= EDGE_ALPHA_LOW_CONFIDENCE) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: minX,
    y: minY
  };
}

function getAlphaNeighborProfile(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  let opaqueCount = 0;
  let transparentCount = 0;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (!offsetX && !offsetY) continue;
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        transparentCount += 1;
        continue;
      }

      const value = alpha[nextY * width + nextX];
      if (value > EDGE_OPAQUE_THRESHOLD) opaqueCount += 1;
      if (value <= EDGE_ALPHA_CLEANUP_THRESHOLD) transparentCount += 1;
    }
  }

  return {
    opaqueCount,
    touchesEdge: transparentCount > 0 && opaqueCount > 0
  };
}

function getWeightedAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  let total = 0;
  let weightTotal = 0;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;

      const weight =
        offsetX === 0 && offsetY === 0 ? 4 : Math.abs(offsetX) + Math.abs(offsetY) === 1 ? 2 : 1;
      total += alpha[nextY * width + nextX] * weight;
      weightTotal += weight;
    }
  }

  return weightTotal ? total / weightTotal : alpha[y * width + x];
}

function isAlphaEdge(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  const center = alpha[y * width + x];
  if (center <= EDGE_ALPHA_CLEANUP_THRESHOLD) return false;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (!offsetX && !offsetY) continue;
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return true;
      if (alpha[nextY * width + nextX] <= EDGE_ALPHA_CLEANUP_THRESHOLD) return true;
    }
  }

  return false;
}

function sampleNearbyForeground(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let radius = 1; radius <= 3 && count < 5; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;

        const pixelIndex = nextY * width + nextX;
        if (alpha[pixelIndex] < EDGE_OPAQUE_THRESHOLD) continue;

        const dataIndex = pixelIndex * 4;
        r += data[dataIndex];
        g += data[dataIndex + 1];
        b += data[dataIndex + 2];
        count += 1;
      }
    }
  }

  if (!count) return null;

  return {
    b: Math.round(b / count),
    g: Math.round(g / count),
    r: Math.round(r / count)
  };
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

function replaceFileExtension(fileName: string, extension: ".jpg" | ".png") {
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
