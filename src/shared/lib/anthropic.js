// Minimal Anthropic caller for shared components. Uses the same env var
// (VITE_ANTHROPIC_KEY) as the Sales app so there's a single key to manage.
// The API key is exposed to the browser; this is a trade-off for v1. When
// the product scales the call should move to a Vercel Function proxy.

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 90000;

export async function callAnthropicShared(prompt, maxTokens = 2500, opts = {}) {
  if (!ANTHROPIC_KEY) throw new Error('Missing VITE_ANTHROPIC_KEY');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Build messages array. `opts.prefill` lets callers force Claude's
    // response to start with a specific string (e.g. `{` to guarantee
    // JSON output with no preamble or code fences).
    const messages = [{ role: 'user', content: prompt }];
    if (opts.prefill) {
      messages.push({ role: 'assistant', content: opts.prefill });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic API ${res.status}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // If the response was truncated by the output limit, the caller will
    // almost certainly fail to parse it. Surface that as a specific error
    // so UIs can show a clear message and retry with more budget.
    if (data.stop_reason === 'max_tokens' && !opts.allowTruncation) {
      const err = new Error('AI response was truncated (hit max_tokens). Increase maxTokens and retry.');
      err.code = 'MAX_TOKENS';
      err.partialText = text;
      throw err;
    }

    // If we used a prefill, glue it back on — the API response only
    // contains what Claude generated AFTER the prefill.
    return opts.prefill ? opts.prefill + text : text;
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}
