const API_URL = 'https://api.openai.com/v1/responses';

export async function generateDraft({ instruction, workspace, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-5-mini', maxOutputTokens = 2000, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า OPENAI_API_KEY สำหรับแอปนี้');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetchImpl(API_URL, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, store: false, max_output_tokens: maxOutputTokens,
        instructions: `You are a social content drafting assistant. Prepare a reviewable draft for a ${workspace.platform} channel named ${workspace.name}. Reply in the same language as the user's instruction unless asked otherwise. Do not claim that content was posted, scheduled, or verified. Do not request credentials. Return the draft text only.`,
        input: instruction
      })
    });
    if (!response.ok) throw new Error(`ส่งคำขอ OpenAI ไม่สำเร็จ (HTTP ${response.status})`);
    const data = await response.json();
    if (data.status && data.status !== 'completed') throw new Error(`OpenAI ตอบสถานะ ${data.status}`);
    const text = (data.output || []).flatMap(item => item.type === 'message' ? item.content || [] : [])
      .filter(part => part.type === 'output_text').map(part => part.text || '').join('\n').trim();
    if (!text) throw new Error('OpenAI ไม่ส่งข้อความกลับมา');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('รอคำตอบจาก OpenAI เกินเวลา');
    if (error.name === 'TypeError') throw new Error('เชื่อมต่อ OpenAI ไม่สำเร็จ');
    throw error;
  } finally { clearTimeout(timer); }
}

export async function testOpenAIConnection(options = {}) {
  await generateDraft({
    instruction: 'Reply with a short acknowledgement in Thai. This is only an API connection test; do not draft or publish content.',
    workspace: { platform: 'test', name: 'connection check' },
    maxOutputTokens: 64,
    ...options
  });
  return { connected: true };
}
