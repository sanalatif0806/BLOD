const { callLLM: callClaude } = require('../llm/client');  // ← only this line changes
const router = require('express').Router();
const prompts = require('../../data/llms_prompts.json');

const keyMapping = {
  f1M: 'F1-M Unique and persistent ID',
  f1D: 'F1-D URIs dereferenceability',
  f2aM: 'F2a-M - Metadata availability via standard primary sources',
  f2bM: 'F2b-M Metadata availability for all the attributes covered in the FAIR score computation',
  f3M: 'F3-M Data referrable via a DOI',
  f4M: 'F4-M Metadata registered in a searchable engine',
  f_score: 'F score',
  a1D: 'A1-D Working access point(s)',
  a1M: 'A1-M Metadata availability via working primary sources',
  a1_2: 'A1.2 Authentication & HTTPS support',
  a2M: 'A2-M Registered in search engines',
  a_score: 'A score',
  r1_1: 'R1.1 Machine- or human-readable license retrievable via any primary source',
  r1_2: 'R1.2 Publisher information, such as authors, contributors, publishers, and sources',
  r1_3D: 'R1.3-D Data organized in a standardized way',
  r1_3M: 'R1.3-M Metadata are described with VoID/DCAT predicates',
  r_score: 'R score',
  i1D: 'I1-D Standard & open representation format',
  i1M: 'I1-M Metadata are described with VoID/DCAT predicates',
  i2: 'I2 Use of FAIR vocabularies',
  i3D: 'I3-D Degree of connection',
  i_score: 'I score',
  fair_score: 'FAIR score',
  analysis_date: 'analysis_date',
};

// ── POST /llm/llm_topic ──────────────────────────────────────────────────────
router.post('/llm_topic', async (req, res) => {
  try {
    const { identifier, title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Missing dataset title' });

    const system = 'You are a biomedical data classifier. Always respond with valid JSON only — no markdown, no explanation, just the JSON object.';
    const user = `Classify this dataset as Health or Not Health.
For Health datasets also specify the sub-category:
  Clinical & Patient Data | Omics & Molecular Data | Medical Imaging & Signals |
  Public Health & Surveillance | Biobank & Research Data | Behavioral & Social Data |
  Terminologies & Metadata | Generic

Dataset ID: ${identifier || 'N/A'}
Title: ${title}
Description: ${description?.en || 'N/A'}

Respond with ONLY this JSON (no other text):
{ "category": "Health", "sub_category": "Public Health & Surveillance" }
If not Health leave values empty. If Health but sub-category unclear, omit sub_category.`;

    const { text, model } = await callClaude(system, user);
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    res.json({ llm_response: parsed, model_used: model });
  } catch (err) {
    console.error('llm_topic error:', err.message);
    res.status(500).json({ error: err.message || 'LLM processing failed' });
  }
});

// ── POST /llm/llm_explain_fair ───────────────────────────────────────────────
router.post('/llm_explain_fair', async (req, res) => {
  try {
    const body = req.body || {};
    const fair_data = body.fair_data ?? body;

    if (!fair_data || typeof fair_data !== 'object' || Object.keys(fair_data).length === 0) {
      return res.status(400).json({ error: 'fair_data is empty or missing' });
    }

    const system = 'You are an expert in Knowledge Graph quality and FAIR principles for healthcare data.';
    const user = `${prompts.explain_FAIR}\n\nFAIR values obtained:\n${JSON.stringify(fair_data, null, 2)}`;

    const { text, model } = await callClaude(system, user);
    res.json({ llm_response: text, model_used: model });
  } catch (err) {
    console.error('llm_explain_fair error:', err.message);
    res.status(500).json({ error: err.message || 'LLM processing failed' });
  }
});

// ── POST /llm/llm_explain_fairness_score_ot ──────────────────────────────────
router.post('/llm_explain_fairness_score_ot', async (req, res) => {
  try {
    const body = req.body || {};
    let fair_data = body.fair_data ?? body;

    if (!fair_data) return res.status(400).json({ error: 'fair_data is missing' });

    const keysToKeep = ['FAIR score', 'F score', 'A score', 'I score', 'R score'];
    if (Array.isArray(fair_data)) {
      fair_data = fair_data.map(entry => {
        const remapped = {};
        for (const [key, val] of Object.entries(entry.FAIRness || {})) {
          const label = keyMapping[key] || key;
          if (keysToKeep.includes(label)) remapped[label] = val;
        }
        return { date: entry.date || entry.analysis_date, scores: remapped };
      });
    }

    const system = 'You are an expert in Knowledge Graph quality and FAIR principles for healthcare data.';
    const user = `${prompts.explain_FAIRness_score_ot}\n\nFAIR score over time:\n${JSON.stringify(fair_data, null, 2)}`;

    const { text, model } = await callClaude(system, user);
    res.json({ llm_response: text, model_used: model });
  } catch (err) {
    console.error('llm_explain_ot error:', err.message);
    res.status(500).json({ error: err.message || 'LLM processing failed' });
  }
});

module.exports = router;