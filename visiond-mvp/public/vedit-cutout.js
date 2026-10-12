// U2NetP inference stays in this browser. The original image is never sent to a service.
const MODEL_SIZE = 320;
let sessionPromise;

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('ยกเลิกการสร้าง ZIP แล้ว', 'AbortError');
}

async function session() {
  if (!globalThis.ort?.InferenceSession) throw new Error('โหลดตัวตัดฉากหลังไม่สำเร็จ');
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths = '/vedit-model/';
    ort.env.wasm.numThreads = 1;
    sessionPromise = ort.InferenceSession.create('/vedit-model/u2netp.onnx', { executionProviders: ['wasm'] });
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

export async function removeProductBackground(file, { signal } = {}) {
  abortIfNeeded(signal);
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    abortIfNeeded(signal);
    const source = document.createElement('canvas');
    source.width = image.width; source.height = image.height;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0);
    const original = sourceContext.getImageData(0, 0, image.width, image.height);
    // A small transparent patch does not mean the opaque photo background is gone.
    // Skip inference only when transparency spans the outside and a meaningful area.
    const alphaAt = (x, y) => original.data[(y * image.width + x) * 4 + 3];
    let clearEdge = 0;
    for (let x = 0; x < image.width; x++) {
      if (alphaAt(x, 0) < 16) clearEdge++;
      if (alphaAt(x, image.height - 1) < 16) clearEdge++;
    }
    for (let y = 1; y < image.height - 1; y++) {
      if (alphaAt(0, y) < 16) clearEdge++;
      if (alphaAt(image.width - 1, y) < 16) clearEdge++;
    }
    const edgeCount = 2 * image.width + 2 * Math.max(0, image.height - 2);
    if (clearEdge >= edgeCount * .2) {
      const transparentThreshold = Math.ceil(image.width * image.height * .05);
      let alphaPixels = 0;
      for (let pixel = 3; pixel < original.data.length; pixel += 4) {
        if (original.data[pixel] < 245 && ++alphaPixels >= transparentThreshold) return source;
      }
    }

    const sample = document.createElement('canvas');
    sample.width = MODEL_SIZE; sample.height = MODEL_SIZE;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    sampleContext.drawImage(image, 0, 0, MODEL_SIZE, MODEL_SIZE);
    const pixels = sampleContext.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
    const plane = MODEL_SIZE * MODEL_SIZE, tensor = new Float32Array(plane * 3);
    const mean = [0.485, 0.456, 0.406], deviation = [0.229, 0.224, 0.225];
    for (let index = 0; index < plane; index++) {
      for (let channel = 0; channel < 3; channel++) tensor[channel * plane + index] = (pixels[index * 4 + channel] / 255 - mean[channel]) / deviation[channel];
    }
    abortIfNeeded(signal);
    const model = await session();
    abortIfNeeded(signal);
    const result = await model.run({ [model.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, MODEL_SIZE, MODEL_SIZE]) });
    abortIfNeeded(signal);
    const output = result[model.outputNames[0]].data;
    let minimum = Infinity, maximum = -Infinity;
    for (const value of output) { if (value < minimum) minimum = value; if (value > maximum) maximum = value; }
    if (!Number.isFinite(minimum) || maximum - minimum < 0.01) throw new Error('โมเดลไม่พบขอบสินค้าในภาพนี้');
    const mask = sampleContext.createImageData(MODEL_SIZE, MODEL_SIZE);
    for (let index = 0; index < plane; index++) {
      const alpha = Math.max(0, Math.min(255, Math.round((output[index] - minimum) / (maximum - minimum) * 255)));
      mask.data[index * 4] = 255; mask.data[index * 4 + 1] = 255; mask.data[index * 4 + 2] = 255; mask.data[index * 4 + 3] = alpha;
    }
    sampleContext.putImageData(mask, 0, 0);
    const scaledMask = document.createElement('canvas');
    scaledMask.width = image.width; scaledMask.height = image.height;
    scaledMask.getContext('2d').drawImage(sample, 0, 0, image.width, image.height);
    sourceContext.globalCompositeOperation = 'destination-in';
    sourceContext.drawImage(scaledMask, 0, 0);
    sourceContext.globalCompositeOperation = 'source-over';
    sample.width = sample.height = scaledMask.width = scaledMask.height = 0;
    return source;
  } finally { image.close?.(); }
}
