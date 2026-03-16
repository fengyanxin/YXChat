import type { Message } from './types';

const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
const API_URL = import.meta.env.VITE_API_URL || '/api/chat/completions';
const MODEL = 'glm-4-flash';

export async function* chatStream(messages: Message[]): AsyncGenerator<string> {
  if (!API_KEY) {
    throw new Error('API key not configured. Please set VITE_ZHIPU_API_KEY in .env');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('API Error:', response.status, error);
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Skip invalid JSON
      }
    }
  }
}
