const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

async function callLLM(system, user, modelOverride) {
  switch (provider) {
    case 'openai':  return callOpenAI(system, user, modelOverride);
    case 'gemini':  return callGemini(system, user, modelOverride);
    case 'claude':  return callClaude(system, user, modelOverride);
    default: throw new Error(`Unknown LLM_PROVIDER: "${provider}". Choose openai | gemini | claude`);
  }
}

async function callOpenAI(system, user, modelOverride) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured in .env');
  const client = new OpenAI({ apiKey });
  const model = modelOverride || process.env.LLM_MODEL || 'gpt-4o-mini';
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
  });
  const text = response.choices[0]?.message?.content || '';
  if (!text) throw new Error('OpenAI returned an empty response.');
  return { text, model: response.model };
}

async function callGemini(system, user, modelOverride) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = modelOverride || process.env.LLM_MODEL || 'gemini-1.5-flash';
  const genModel = genAI.getGenerativeModel({ model });
  const result = await genModel.generateContent(`${system}\n\n${user}`);
  const text = result.response.text();
  if (!text) throw new Error('Gemini returned an empty response.');
  return { text, model };
}

async function callClaude(system, user, modelOverride) {
  const Anthropic = require('@anthropic-ai/sdk');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-your')) throw new Error('ANTHROPIC_API_KEY is not configured in .env');
  const client = new Anthropic({ apiKey });
  const model = modelOverride || process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
  if (!text) throw new Error('Claude returned an empty response.');
  return { text, model: response.model };
}

module.exports = { callLLM, callClaude };