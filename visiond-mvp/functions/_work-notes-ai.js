const clean = value => String(value || '').trim();
const model = (value, fallback) => /^[a-zA-Z0-9._:-]{1,100}$/.test(clean(value)) ? clean(value) : fallback;

const geminiText = payload => (payload?.candidates?.[0]?.content?.parts || [])
  .map(part => typeof part?.text === 'string' ? part.text : '')
  .join('')
  .trim();

export async function requestWorkNotesAI(env, prompt, { jsonMode = false, maxTokens = 2200, temperature = .2, deadlineMs = 9000 } = {}) {
  const providers = [];
  const configuredModel = model(env.WORK_NOTES_GEMINI_MODEL, 'gemini-2.5-flash');
  const geminiModels = [...new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  for (const key of [clean(env.GEMINI_API_KEY), clean(env.GEMINI_API_KEY_2)]) {
    if (key && !providers.some(provider => provider.key === key)) providers.push({ name: 'gemini', key });
  }
  if (!providers.length) throw new Error('AI_NOT_CONFIGURED');

  const controllers = providers.map(() => new AbortController());
  const attempts = providers.map(async (provider, index) => {
    const controller = controllers[index];
    const failures = [];
    for (const geminiModel of geminiModels) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': provider.key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { ...(jsonMode ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: 0 }, temperature, maxOutputTokens: maxTokens } }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = `${provider.name.toUpperCase()}_${geminiModel}_HTTP_${response.status}`;
          if (response.status !== 404) throw new Error(code);
          failures.push(code);
          continue;
        }
        const text = geminiText(payload);
        if (text) return text;
        failures.push(`${provider.name.toUpperCase()}_${geminiModel}_EMPTY`);
      } catch (error) {
        if (controller.signal.aborted) throw new Error(`${provider.name.toUpperCase()}_CANCELLED`);
        if (/^GEMINI_/.test(String(error?.message))) throw error;
        throw new Error(`${provider.name.toUpperCase()}_NETWORK`);
      }
    }
    throw new Error(failures.join(',') || `${provider.name.toUpperCase()}_MODEL_UNAVAILABLE`);
  });
  let deadlineId;
  const deadline = new Promise((_, reject) => {
    deadlineId = setTimeout(() => {
      controllers.forEach(controller => controller.abort('deadline'));
      reject(new Error('AI_DEADLINE'));
    }, deadlineMs);
  });
  try {
    return await Promise.race([Promise.any(attempts), deadline]);
  } catch (error) {
    if (String(error?.message) === 'AI_DEADLINE') throw error;
    const failures = (error?.errors || []).map(failure => String(failure?.message || failure)).filter(Boolean);
    throw new Error(failures.join(',') || 'AI_PROVIDER_FAILED');
  } finally {
    clearTimeout(deadlineId);
    controllers.forEach(controller => controller.abort('finished'));
  }
}
