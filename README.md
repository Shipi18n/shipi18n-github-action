# Shipi18n GitHub Action

[![selftest](https://github.com/Shipi18n/shipi18n-github-action/actions/workflows/selftest.yml/badge.svg)](https://github.com/Shipi18n/shipi18n-github-action/actions/workflows/selftest.yml)
[![release](https://img.shields.io/github/v/release/Shipi18n/shipi18n-github-action?label=release)](https://github.com/Shipi18n/shipi18n-github-action/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Check your locale files on every PR — no API key, no account.** Missing keys, dropped
placeholders, collapsed plurals, empty values, untranslated strings and glossary breaches, with
SARIF output so GitHub annotates the failing keys inline. Every finding links to its
[rule page](https://shipi18n.com/docs/rules/missing-key).

The same action can also **translate** what fails, with your own OpenAI or Anthropic key
(`mode: translate` — the v2 behavior, unchanged).

## Quickstart — check mode (v3 default)

```yaml
name: i18n check
on: [pull_request]
permissions:
  contents: read
  security-events: write   # for the SARIF upload
jobs:
  i18n:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Shipi18n/shipi18n-github-action@v3
        with:
          locales: ./locales
          source-language: en
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: shipi18n.sarif
```

Fails the job on errors (configurable with `fail-on: warning|none`, `min-coverage`, `ignore-keys`,
`glossary`). Zero model calls — nothing to pay for and nothing to leak.

> **v2 → v3:** the default `mode` is now `check`. Pins to `@v2` keep the old translate-on-push
> behavior; to translate with v3, set `mode: translate`.

## Translate mode

```yaml
# .github/workflows/translate.yml
name: Auto Translate
on:
  push:
    branches: [main]
    paths: ['locales/en.json']

jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # needed for incremental mode (diff vs previous commit)
      - uses: Shipi18n/shipi18n-github-action@v3
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        with:
          mode: translate
          provider: anthropic
          source-file: locales/en.json
          target-languages: es,fr,de,ja
```

Store your LLM key as a repository secret (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) and reference it via
`env:`. The key is used to call **your** LLM directly — nothing is sent to a Shipi18n server.

## Inputs

**Check mode:**

| Input | Default | Description |
| --- | --- | --- |
| `mode` | `check` | `check` (validate, no key) or `translate` (v2 behavior) |
| `locales` | `./locales` | Locale root — flat `locales/<lang>.json` or nested `locales/<lang>/<ns>.json` |
| `source-language` | `en` | Source language code |
| `fail-on` | `error` | Fail the job on `error`, `warning`, or `none` |
| `min-coverage` | — | Fail any language below this coverage % |
| `ignore-keys` | — | Comma-separated `*` globs of keys to silence |
| `glossary` | — | Glossary JSON path (do-not-translate + locked terms) |
| `sarif-file` | `shipi18n.sarif` | Where the SARIF report is written |

**Translate mode:**

| Input | Default | Description |
| --- | --- | --- |
| `provider` | `anthropic` | LLM provider: `anthropic` or `openai` |
| `api-key` | env var | LLM key; falls back to `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` |
| `model` | provider default | Override the model |
| `source-file` | — | Source locale file (use this **or** `source-dir`) |
| `source-dir` | — | Source locale directory — translates every `.json` file |
| `target-languages` | — | **Required.** Comma-separated codes, e.g. `es,fr,de` |
| `output-dir` | source dir | Where translated files are written |
| `source-language` | `en` | Source language code |
| `create-pr` | `false` | Open a PR instead of committing directly |
| `incremental` | `true` | Only translate changed keys (diff vs previous commit) |
| `commit-message` | `chore: update translations [skip ci]` | Commit message |
| `branch-name` | `shipi18n-translations` | Branch prefix for PRs |
| `github-token` | `GITHUB_TOKEN` | Token for creating PRs |
| `skip-keys` | — | Exact dot-paths to leave untranslated (e.g. `brandName,company.name`) |
| `skip-paths` | — | Glob patterns to skip (e.g. `states.*,config.*.secret`) |

## Outputs

Check mode: `errors`, `warnings`, `sarif-file`.
Translate mode: `files-changed`, `files-list`, `languages`, `verification-errors`,
`verification-warnings`, `skipped-keys-count`.

## Modes

- **Incremental** (default): diffs the source against the previous commit and only translates
  added/modified keys, merging into existing target files and removing deleted keys. Requires
  `fetch-depth: 2` on checkout.
- **Skip keys/paths**: brand names, codes, or internal values matched by `skip-keys` (exact) or
  `skip-paths` (glob) keep their source value and are never sent to the LLM.
- **Verification**: every run checks placeholder preservation, key consistency, and length sanity, and
  surfaces issues in the PR body and action outputs.

More examples in [`examples/`](./examples).

> **v2 note:** JSON locale files are supported. The v1 hosted-API features (LLM-based semantic
> verification, self-correction, dashboard sync, YAML input) are not part of the open-source BYO-LLM
> action.

## License

Apache-2.0
