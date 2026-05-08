# Contributing

Thanks for contributing to Agent Code Tracker.

## Development Setup

1. Install dependencies:
   - npm ci
2. Build and validate:
   - npm run compile
3. Run extension in debug mode:
   - Press F5 in VS Code

## Pull Request Guidelines

- Use a feature branch from main.
- Keep PRs focused and small.
- Add or update tests where applicable.
- Update README.md and CHANGELOG.md for user-visible changes.
- Ensure checks pass before requesting review.

## Coding Standards

- Use TypeScript strict typing patterns.
- Keep changes consistent with existing style.
- Avoid unrelated refactors in the same PR.

## Commit Messages

Use clear imperative messages, for example:
- Add branch-aware team summary cards
- Fix percentage calculation for merged stats

## Security

Do not commit secrets, API keys, or private credentials.
If you find a security issue, follow SECURITY.md.
