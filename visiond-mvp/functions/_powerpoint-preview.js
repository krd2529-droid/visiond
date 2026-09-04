const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const color = (value, fallback) => /^[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;

export function validatedPowerpointPreview(raw, attachmentCount = 0) {
  if (!raw) return null;
  if (String(raw).length > 120000) throw new Error('PREVIEW_SIZE');
  let input; try { input = JSON.parse(String(raw)); } catch { throw new Error('PREVIEW_JSON'); }
  const pages = (Array.isArray(input.pages) ? input.pages : []).slice(0, 250).map(page => ({
    title: clean(page?.title, 180),
    bullets: (Array.isArray(page?.bullets) ? page.bullets : []).slice(0, 8).map(bullet => ({
      text: clean(bullet?.text, 1200),
      attachment_numbers: [...new Set(Array.isArray(bullet?.attachment_numbers) ? bullet.attachment_numbers.map(Number) : [])]
        .filter(number => Number.isInteger(number) && number >= 1 && number <= attachmentCount),
    })).filter(bullet => bullet.text),
  })).filter(page => page.title || page.bullets.length);
  if (!pages.length) throw new Error('PREVIEW_EMPTY');
  return {
    deck_title: clean(input.deck_title, 180) || 'PowerPoint', subtitle: clean(input.subtitle, 300),
    colors: { accent: color(input.colors?.accent, '0ABAB5'), pale: color(input.colors?.pale, 'FFFFFF'), title: color(input.colors?.title, '063D3B') },
    pages,
  };
}

export const previewManifestKey = objectKey => `${objectKey}.preview.json`;
export const previewImageKey = (objectKey, number) => `${objectKey}.preview/image-${number}`;
