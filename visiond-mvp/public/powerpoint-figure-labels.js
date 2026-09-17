const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const parts = value => value.split('.').map(Number);
const isUnboundPlaceholder = value => /\[(?:ข้อมูลที่ต้องเติม|placeholder)|รูปประกอบตามโน้ต/i.test(clean(value));
const stepLabels = value => [...clean(value).matchAll(/(?:^|[\s/([{-])(\d+(?:\.\d+)+)(?=$|[\s):,;\]-])/g)].map(match => match[1]).filter((label, index, labels) => labels.indexOf(label) === index);
const hasOpeningLink = value => /(?:https?:\/\/|เข้า(?:สู่)?ลิงก์|เปิดลิงก์|ลิงก์เริ่มต้น)/i.test(clean(value));
const consecutive = labels => labels.length > 1 && labels.every((label, index) => {
  if (!index) return true;
  const previous = parts(labels[index - 1]), current = parts(label);
  return previous.length === current.length && previous.slice(0, -1).every((part, partIndex) => part === current[partIndex]) && current.at(-1) === previous.at(-1) + 1;
});

export function semanticFigureLabel(topicText = '') {
  if (isUnboundPlaceholder(topicText)) return '';
  const labels = stepLabels(topicText);
  if (labels.length === 1) return labels[0];
  if (consecutive(labels)) return `${labels[0]}–${labels.at(-1)}`;
  if (labels.length > 1) return labels.join(', ');
  return hasOpeningLink(topicText) ? 'ลิงก์เริ่มต้น' : '';
}

export function semanticFigureLabels(topicText, attachmentNumbers) {
  const numbers = [...attachmentNumbers], output = {};
  if (isUnboundPlaceholder(topicText)) {
    numbers.forEach(number => { output[number] = ''; });
    return output;
  }
  const labels = stepLabels(topicText);
  let ordered = [];
  if (hasOpeningLink(topicText) && numbers.length === labels.length + 1) ordered = ['ลิงก์เริ่มต้น', ...labels];
  else if (numbers.length === labels.length && labels.length) ordered = labels;
  else if (numbers.length === 1 && consecutive(labels)) ordered = [`${labels[0]}–${labels.at(-1)}`];
  else if (numbers.length === 1 && labels.length === 1) ordered = labels;
  else if (numbers.length === 1 && !labels.length && hasOpeningLink(topicText)) ordered = ['ลิงก์เริ่มต้น'];
  numbers.forEach((number, index) => { output[number] = ordered[index] || ''; });
  return output;
}

export function visibleFigureLabel(topicText, _slideTitle, attachmentNumber, explicitLabel = '') {
  const semantic = clean(explicitLabel) || semanticFigureLabel(topicText);
  if (semantic === 'ลิงก์เริ่มต้น') return 'รูปประกอบลิงก์เริ่มต้น';
  if (semantic) return `รูป ${semantic}`;
  if (isUnboundPlaceholder(topicText)) return 'รูปประกอบที่ยังไม่ผูกขั้นตอน';
  return 'รูปประกอบหัวข้อนี้';
}

export function visibleFigureLabels(topicText, slideTitle, attachmentNumbers, explicitLabels = {}) {
  const semantic = semanticFigureLabels(topicText, attachmentNumbers), output = {};
  for (const number of attachmentNumbers) output[number] = visibleFigureLabel(topicText, slideTitle, number, explicitLabels[number] || semantic[number]);
  return output;
}
