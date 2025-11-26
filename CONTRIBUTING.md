# Contributing to Shipi18n GitHub Action

Thank you for your interest in contributing to the Shipi18n GitHub Action! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your workflow file (sanitized)
- Action logs or error messages
- Repository setup details

### Suggesting Enhancements

We welcome suggestions for new features or improvements! Please create an issue with:

- A clear description of the enhancement
- Why this would be useful
- Example use cases
- Any implementation ideas

### Pull Requests

1. **Fork the repository** and create your branch from `main`

```bash
git checkout -b feature/my-new-feature
```

2. **Make your changes**

   - Follow the existing code style
   - Add comments where necessary
   - Update documentation if needed

3. **Test your changes**

```bash
npm install
npm test  # if tests exist
```

4. **Commit your changes**

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add support for custom output directory"
```

5. **Push to your fork**

```bash
git push origin feature/my-new-feature
```

6. **Open a Pull Request**

   - Describe what your PR does
   - Reference any related issues
   - Include example workflow usage

## Code Style Guidelines

### JavaScript/GitHub Actions

- Use clear, descriptive variable names
- Add comments for complex logic
- Handle errors gracefully
- Provide helpful error messages
- Follow GitHub Actions best practices

**Example:**

```javascript
const core = require('@actions/core')
const github = require('@actions/github')

try {
  const apiKey = core.getInput('api-key', { required: true })
  const sourceFile = core.getInput('source-file', { required: true })

  // Validate inputs
  if (!apiKey.startsWith('sk_')) {
    throw new Error('Invalid API key format')
  }

  // Action logic here

  core.setOutput('status', 'success')
} catch (error) {
  core.setFailed(error.message)
}
```

### Action Design

- Use `@actions/core` for inputs/outputs
- Use `@actions/github` for GitHub API access
- Validate all inputs
- Provide clear error messages
- Set appropriate outputs
- Use action groups for better logs

### File Organization

```
shipi18n-github-action/
├── action.yml           # Action metadata
├── index.js             # Main action logic
├── .github/
│   └── workflows/       # CI workflows
└── README.md
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- A Shipi18n API key (for testing)
- A GitHub repository for testing

### Local Development

1. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/shipi18n-github-action.git
cd shipi18n-github-action
```

2. Install dependencies

```bash
npm install
```

3. Test locally with `act` (optional)

```bash
# Install act: https://github.com/nektos/act
npm install -g @nektos/act

# Run workflow locally
act -s SHIPI18N_API_KEY=your_key_here
```

4. Test in a real workflow

Create a test repository and use your fork:

```yaml
- uses: YOUR_USERNAME/shipi18n-github-action@your-branch
  with:
    api-key: ${{ secrets.SHIPI18N_API_KEY }}
    source-file: 'locales/en.json'
    target-languages: 'es,fr'
```

## Testing

Before submitting a PR:

1. Test the action in a real workflow
2. Verify error handling
3. Check action outputs
4. Test with different input combinations
5. Verify files are committed correctly

### Example Test Workflow

```yaml
name: Test Action

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create test file
        run: echo '{"hello":"Hello"}' > en.json

      - name: Test Shipi18n Action
        uses: ./
        with:
          api-key: ${{ secrets.SHIPI18N_API_KEY }}
          source-file: 'en.json'
          target-languages: 'es,fr'

      - name: Verify outputs
        run: |
          ls -la
          cat es.json
          cat fr.json
```

## Documentation

If you add new features:

- Update README.md with usage examples
- Update action.yml with new inputs/outputs
- Add comments to functions
- Include workflow examples

## GitHub Actions Best Practices

- Use semantic versioning for releases
- Keep action fast (cache dependencies)
- Provide clear error messages
- Set appropriate action outputs
- Use action groups for log organization
- Handle rate limits gracefully

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Read the [GitHub Actions documentation](https://docs.github.com/en/actions)
- Read the [Shipi18n documentation](https://shipi18n.com/docs)

## Publishing Updates

When ready to publish a new version:

1. Update version in `package.json`
2. Create a new release tag

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

3. Update major version tag

```bash
git tag -fa v1 -m "Update v1 to v1.1.0"
git push origin v1 --force
```

4. Create GitHub Release with changelog

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Keep discussions focused and professional

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Shipi18n GitHub Action! 🎉
