const clean = value => String(value || '').trim();
const model = (value, fallback) => /^[a-zA-Z0-9._:-]{1,100}$/.test(clean(value)) ? clean(value) : fallback;

const geminiText = payload => (payload?.candidates?.[0]?.content?.parts || [])
  .map(part => typeof part?.text === 'string' ? part.text : '')
  .join('')
  .trim();

export async function requestWorkNotesAI(env, prompt, { jsonMode = false, maxTokens = 3500, temperature = .2 } = {}) {
  const providers = [];
  const geminiModel = model(env.GEMINI_TEXT_MODEL, 'gemini-2.5-flash');
  for (const key of [clean(env.GEMINI_API_KEY), clean(env.GEMINI_API_KEY_2)]) {
    if (key && !providers.some(provider => provider.key === key)) providers.push({ name: 'gemini', key, model: geminiModel });
  }
  if (!providers.length) throw new Error('AI_NOT_CONFIGURED');

  const controllers = providers.map(() => new AbortController());
  const attempts = providers.map(async (provider, index) => {
    const controller = controllers[index];
    const timeout = setTimeout(() => controller.abort('timeout'), 20000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': provider.key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { ...(jsonMode ? { responseMimeType: 'application/json' } : {}), temperature, maxOutputTokens: maxTokens } }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`${provider.name.toUpperCase()}_HTTP_${response.status}`);
      const text = geminiText(payload);
      if (text) return text;
      throw new Error(`${provider.name.toUpperCase()}_EMPTY`);
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`${provider.name.toUpperCase()}_TIMEOUT`);
      if (/^GEMINI_/.test(String(error?.message))) throw error;
      throw new Error(`${provider.name.toUpperCase()}_NETWORK`);
    } finally {
      clearTimeout(timeout);
    }
  });
  try {
    const text = await Promise.any(attempts);
    controllers.forEach(controller => controller.abort('winner-selected'));
    return text;
  } catch (error) {
    controllers.forEach(controller => controller.abort('all-failed'));
    const failures = (error?.errors || []).map(failure => String(failure?.message || failure)).filter(Boolean);
    throw new Error(failures.join(',') || 'AI_PROVIDER_FAILED');
  }
}
