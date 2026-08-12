"use strict";
exports.id = 400;
exports.ids = [400];
exports.modules = {

/***/ 6400:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  LANGUAGE_NAMES: () => (/* reexport */ LANGUAGE_NAMES),
  anthropicAdapter: () => (/* reexport */ anthropicAdapter),
  extractPlaceholders: () => (/* reexport */ extractPlaceholders),
  flatten: () => (/* reexport */ flatten),
  getLanguageName: () => (/* reexport */ getLanguageName),
  openaiAdapter: () => (/* reexport */ openaiAdapter),
  resolveAdapter: () => (/* reexport */ resolveAdapter),
  translateJSON: () => (/* reexport */ translateJSON),
  translateStrings: () => (/* reexport */ translateStrings),
  unflatten: () => (/* reexport */ unflatten),
  validatePlaceholders: () => (/* reexport */ validatePlaceholders)
});

;// CONCATENATED MODULE: ./node_modules/@shipi18n/core/src/adapters/index.js
/**
 * LLM provider adapters. Each adapter exposes a single method:
 *   complete(prompt: string, opts?: { maxTokens?: number }): Promise<string>
 *
 * This is the ONLY provider-specific surface in @shipi18n/core. The translation
 * engine, prompts, placeholder handling, and batching are all provider-agnostic.
 *
 * @typedef {Object} LLMAdapter
 * @property {(prompt: string, opts?: { maxTokens?: number }) => Promise<string>} complete
 * @property {string} name
 */

/**
 * Anthropic Claude adapter. Requires the optional peer dep `@anthropic-ai/sdk`.
 * Key resolved from opts.apiKey or the ANTHROPIC_API_KEY env var (SDK default).
 * @param {{ apiKey?: string, model?: string }} [config]
 * @returns {LLMAdapter}
 */
function anthropicAdapter(config = {}) {
  const model = config.model || 'claude-opus-4-8'
  let clientPromise = null
  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = __webpack_require__.e(/* import() */ 938).then(__webpack_require__.bind(__webpack_require__, 7938))
        .then(({ default: Anthropic }) => new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {}))
        .catch(() => {
          throw new Error(
            "The 'anthropic' provider requires the '@anthropic-ai/sdk' package. Install it with: npm i @anthropic-ai/sdk"
          )
        })
    }
    return clientPromise
  }

  return {
    name: 'anthropic',
    async complete(prompt, opts = {}) {
      const client = await getClient()
      // Adaptive thinking + generous default; the model decides depth.
      const res = await client.messages.create({
        model,
        max_tokens: opts.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = (res.content || []).find((b) => b.type === 'text')
      if (!text) throw new Error('Anthropic response contained no text block')
      return text.text.trim()
    },
  }
}

/**
 * OpenAI adapter. Requires the optional peer dep `openai`.
 * Key resolved from opts.apiKey or the OPENAI_API_KEY env var (SDK default).
 * @param {{ apiKey?: string, model?: string }} [config]
 * @returns {LLMAdapter}
 */
function openaiAdapter(config = {}) {
  const model = config.model || 'gpt-4o'
  let clientPromise = null
  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = __webpack_require__.e(/* import() */ 4).then(__webpack_require__.bind(__webpack_require__, 2004))
        .then(({ default: OpenAI }) => new OpenAI(config.apiKey ? { apiKey: config.apiKey } : {}))
        .catch(() => {
          throw new Error(
            "The 'openai' provider requires the 'openai' package. Install it with: npm i openai"
          )
        })
    }
    return clientPromise
  }

  return {
    name: 'openai',
    async complete(prompt, opts = {}) {
      const client = await getClient()
      const res = await client.chat.completions.create({
        model,
        max_tokens: opts.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const content = res.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI response contained no content')
      return content.trim()
    },
  }
}

/**
 * Resolve a provider name (+ config) to an adapter instance.
 * @param {'anthropic'|'openai'|LLMAdapter} provider
 * @param {{ apiKey?: string, model?: string }} [config]
 * @returns {LLMAdapter}
 */
function resolveAdapter(provider, config = {}) {
  if (provider && typeof provider === 'object' && typeof provider.complete === 'function') {
    return provider // already an adapter (also lets users bring a custom provider)
  }
  switch (provider) {
    case 'anthropic':
      return anthropicAdapter(config)
    case 'openai':
      return openaiAdapter(config)
    default:
      throw new Error(
        `Unknown provider '${provider}'. Use 'anthropic', 'openai', or pass a custom { complete } adapter.`
      )
  }
}

;// CONCATENATED MODULE: ./node_modules/@shipi18n/core/src/languages.js
/**
 * Language code → human-readable name. Ported from the backend so prompts read
 * naturally ("Translate from English to Spanish") rather than using bare codes.
 */
const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', zh: 'Chinese', 'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
  tr: 'Turkish', pl: 'Polish', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', ms: 'Malay',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech', sk: 'Slovak',
  hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian', uk: 'Ukrainian', el: 'Greek',
  he: 'Hebrew', fa: 'Persian',
}

/**
 * @param {string} code e.g. "es" or "pt-BR"
 * @returns {string} the language name, falling back to the base code, then the code
 */
function getLanguageName(code) {
  if (!code) return code
  if (LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code]
  const base = code.split('-')[0]
  return LANGUAGE_NAMES[base] || code
}

;// CONCATENATED MODULE: ./node_modules/@shipi18n/core/src/placeholders.js
/**
 * Placeholder detection + validation.
 *
 * i18n strings embed placeholders that must survive translation byte-for-byte:
 *   - i18next / ICU:  {{name}}, {count}
 *   - printf:         %s, %d, %1$s
 *   - i18next nesting: $t(some.key)
 *   - React-intl:     {name}
 *   - Ruby / others:  %{name}
 *
 * The translation prompt instructs the model to preserve these; these helpers
 * VERIFY the model obeyed, so callers can retry or flag drift.
 */

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/g, // {{name}}
  /\$t\([^)]*\)/g, // $t(key)
  /%\{[^}]+\}/g, // %{name}
  /%\d+\$[sdfx]/g, // %1$s
  /%[sdfx]/g, // %s %d
  /\{[a-zA-Z0-9_.]+\}/g, // {count} {name}  (after the {{ }} pass)
]

/**
 * Extract all placeholders from a string, in a stable, comparable multiset.
 * @param {string} str
 * @returns {string[]} sorted list of placeholder tokens (duplicates preserved)
 */
function extractPlaceholders(str) {
  if (typeof str !== 'string') return []
  let working = str
  const found = []
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = working.match(pattern) || []
    for (const m of matches) found.push(m)
    // blank out matched spans so later, looser patterns don't double-count
    working = working.replace(pattern, (m) => ' '.repeat(m.length))
  }
  return found.sort()
}

/**
 * Does the translation preserve exactly the placeholders of the source?
 * @param {string} source
 * @param {string} translation
 * @returns {{ ok: boolean, missing: string[], added: string[] }}
 */
function validatePlaceholders(source, translation) {
  const src = extractPlaceholders(source)
  const out = extractPlaceholders(translation)
  const outCounts = tally(out)
  const srcCounts = tally(src)
  const missing = []
  const added = []
  for (const [ph, n] of Object.entries(srcCounts)) {
    const diff = n - (outCounts[ph] || 0)
    for (let i = 0; i < diff; i++) missing.push(ph)
  }
  for (const [ph, n] of Object.entries(outCounts)) {
    const diff = n - (srcCounts[ph] || 0)
    for (let i = 0; i < diff; i++) added.push(ph)
  }
  return { ok: missing.length === 0 && added.length === 0, missing, added }
}

function tally(arr) {
  const t = {}
  for (const x of arr) t[x] = (t[x] || 0) + 1
  return t
}

;// CONCATENATED MODULE: ./node_modules/@shipi18n/core/src/translate.js
/**
 * Core translation engine — provider-agnostic. Ported from the backend's
 * context-aware Claude path, with the single `client.messages.create` call
 * replaced by an injected LLMAdapter.
 */




const BATCH_PROMPT = `You are a professional software localizer. Translate each UI string accurately.

Translate from {SOURCE_LANG} to {TARGET_LANG}.

STRINGS TO TRANSLATE (JSON array):
{TEXTS}

Requirements:
1. Preserve ALL placeholders exactly as they appear: {{name}}, {count}, %s, %d, %1$s, $t(...), %{name}.
2. Do not translate placeholder contents, HTML tags, or code.
3. Keep the tone appropriate for application UI (concise, natural).
4. Return ONLY a JSON array of translated strings, in the same order and length as the input. No prose, no markdown fences.`

/**
 * Flatten a nested object into dot-path → string entries (arrays indexed).
 * Non-string leaves (numbers, booleans, null) are left in place and not translated.
 */
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out)
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v && typeof v === 'object') flatten(v, `${path}.${i}`, out)
        else out[`${path}.${i}`] = v
      })
    } else {
      out[path] = value
    }
  }
  return out
}

/** Rebuild a nested object from dot-path entries. */
function unflatten(flat) {
  const root = {}
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      const nextIsIndex = /^\d+$/.test(parts[i + 1])
      if (node[key] == null) node[key] = nextIsIndex ? [] : {}
      node = node[key]
    }
    node[parts[parts.length - 1]] = value
  }
  return root
}

function parseJsonArray(text, expectedLength) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('LLM did not return a JSON array')
    parsed = JSON.parse(match[0])
  }
  if (!Array.isArray(parsed) || parsed.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength} translations, got ${parsed?.length ?? 0}`)
  }
  return parsed
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Translate a batch of strings via the adapter.
 * @param {string[]} texts
 * @param {object} opts { adapter, from, to, batchSize }
 * @returns {Promise<string[]>}
 */
async function translateStrings(texts, { adapter, from, to, batchSize = 40 }) {
  const results = new Array(texts.length)
  const batches = chunk(
    texts.map((t, i) => ({ t, i })),
    batchSize
  )
  for (const batch of batches) {
    const prompt = BATCH_PROMPT
      .replace('{SOURCE_LANG}', getLanguageName(from))
      .replace('{TARGET_LANG}', getLanguageName(to))
      .replace('{TEXTS}', JSON.stringify(batch.map((b) => b.t), null, 2))
    const raw = await adapter.complete(prompt, { maxTokens: 8192 })
    const translated = parseJsonArray(raw, batch.length)
    batch.forEach((b, idx) => {
      results[b.i] = translated[idx]
    })
  }
  return results
}

/**
 * Translate a locale JSON object from one language to another, preserving
 * structure and placeholders. BYO-LLM: pass provider + key (or a custom adapter).
 *
 * @param {object} params
 * @param {Record<string, any>} params.content   source locale object
 * @param {string} params.from                   source language code
 * @param {string} params.to                     target language code
 * @param {'anthropic'|'openai'|object} params.provider  provider name or a custom adapter
 * @param {string} [params.apiKey]               LLM API key (else provider env var)
 * @param {string} [params.model]                override the provider's default model
 * @param {Record<string,any>} [params.existing] prior translation → only re-translate changed/new keys (incremental)
 * @returns {Promise<{ result: object, stats: { translated: number, reused: number, placeholderWarnings: Array }}>}
 */
async function translateJSON({ content, from, to, provider, apiKey, model, existing }) {
  const adapter = resolveAdapter(provider, { apiKey, model })
  const sourceFlat = flatten(content)
  const existingFlat = existing ? flatten(existing) : {}

  // Incremental: only translate keys that are new or whose source presumably changed.
  // (Without a stored source snapshot we treat "already has a translation" as reusable;
  //  callers that track source hashes can pass a filtered `existing`.)
  const entries = Object.entries(sourceFlat)
  const toTranslate = []
  const outFlat = {}
  for (const [path, value] of entries) {
    if (typeof value !== 'string') {
      outFlat[path] = value // non-string leaves pass through untouched
    } else if (existingFlat[path] != null && existingFlat[path] !== '') {
      outFlat[path] = existingFlat[path] // reuse prior translation
    } else {
      toTranslate.push({ path, value })
    }
  }

  const placeholderWarnings = []
  if (toTranslate.length > 0) {
    const translated = await translateStrings(
      toTranslate.map((e) => e.value),
      { adapter, from, to }
    )
    toTranslate.forEach((e, i) => {
      const out = translated[i]
      outFlat[e.path] = out
      const check = validatePlaceholders(e.value, out)
      if (!check.ok) {
        placeholderWarnings.push({ path: e.path, source: e.value, translation: out, ...check })
      }
    })
  }

  return {
    result: unflatten(outFlat),
    stats: {
      translated: toTranslate.length,
      reused: entries.length - toTranslate.length - entries.filter(([, v]) => typeof v !== 'string').length,
      placeholderWarnings,
    },
  }
}

;// CONCATENATED MODULE: ./node_modules/@shipi18n/core/src/index.js
/**
 * @shipi18n/core — open-source, bring-your-own-LLM i18n translation engine.
 *
 * @example
 *   import { translateJSON } from '@shipi18n/core'
 *   const { result } = await translateJSON({
 *     content: { greeting: 'Hello {{name}}' },
 *     from: 'en', to: 'es',
 *     provider: 'anthropic',           // or 'openai', or a custom { complete } adapter
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   })
 */






/***/ })

};
;
//# sourceMappingURL=400.index.js.map