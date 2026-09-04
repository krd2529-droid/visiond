const clean = value => String(value || '').trim();
const model = (value, fallback) => /^[a-zA-Z0-9._:-]{1,100}$/.test(clean(value)) ? clean(value) : fallback;

const geminiText = payload => (payload?.candidates?.[0]?.content?.parts || [])
  .map(part => typeof part?.text === 'string' ? part.text : '')
  .join('')
  .trim();

export async function requestWorkNotesAI(env, prompt, { jsonMode = false, maxTokens = 7000, temperature = .2 } = {}) {
  const providers = [];
  const geminiModel = model(env.GEMINI_TEXT_MODEL, 'gemini-2.5-flash');
  for (const key of [clean(env.GEMINI_API_KEY), clean(env.GEMINI_API_KEY_2)]) {
    if (key && !providers.some(provider => provider.key === key)) providers.push({ name: 'gemini', key, model: geminiModel });
  }
  if (!providers.length) throw new Error('AI_NOT_CONFIGURED');

  const failures = [];
  for (const provider of providers) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': provider.key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { ...(jsonMode ? { responseMimeType: 'application/json' } : {}), temperature, maxOutputTokens: maxTokens } }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        failures.push(`${provider.name.toUpperCase()}_HTTP_${response.status}`);
        continue;
      }
      const text = geminiText(payload);
      if (text) return text;
      failures.push(`${provider.name.toUpperCase()}_EMPTY`);
    } catch (error) {
      failures.push(`${provider.name.toUpperCase()}_${error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK'}`);
    }
  }
  throw new Error(failures.join(',') || 'AI_PROVIDER_FAILED');
}
