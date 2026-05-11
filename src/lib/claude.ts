import { supabase } from './supabase';

const LS_KEY = 'claude_api_key';

export async function getClaudeApiKey(): Promise<string | null> {
  const local = localStorage.getItem(LS_KEY);
  if (local) return local;

  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'claude_api_key')
    .maybeSingle();

  if (data?.value) {
    localStorage.setItem(LS_KEY, data.value);
    return data.value;
  }
  return null;
}

export async function saveClaudeApiKey(key: string): Promise<void> {
  localStorage.setItem(LS_KEY, key);
  await supabase
    .from('app_config')
    .upsert({ key: 'claude_api_key', value: key, updated_at: new Date().toISOString() });
}

export async function callClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = await getClaudeApiKey();
  if (!apiKey) {
    throw new Error('Claude API anahtarı Ayarlar sayfasından girilmeli');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data.content[0].text;
}
