export function paginateDeckSlides(slides) {
  const pages = [];
  for (const slide of Array.isArray(slides) ? slides : []) {
    let textOnly = [];
    const flushText = () => {
      for (let index = 0; index < textOnly.length; index += 2) pages.push({ title: slide.title, bullets: textOnly.slice(index, index + 2), speaker_notes: slide.speaker_notes });
      textOnly = [];
    };
    for (const bullet of Array.isArray(slide.bullets) ? slide.bullets : []) {
      const numbers = [...new Set(Array.isArray(bullet.attachment_numbers) ? bullet.attachment_numbers : [])];
      if (!numbers.length) { textOnly.push({ ...bullet, attachment_numbers: [] }); continue; }
      flushText();
      for (let index = 0; index < numbers.length; index += 2) pages.push({ title: slide.title, bullets: [{ ...bullet, attachment_numbers: numbers.slice(index, index + 2) }], speaker_notes: slide.speaker_notes });
    }
    flushText();
  }
  return pages;
}
