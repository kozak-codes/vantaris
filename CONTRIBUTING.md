# Contributing to Vantaris

Thanks for your interest in contributing! This project is licensed under the [Cryptographic Autonomy License 1.0 (Combined Work Exception)](LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/kozak-codes/vantaris.git`
3. Install dependencies: `npm ci`
4. Start development: `npm run dev`

## Development

### Prerequisites

- Node.js 22+
- npm 10+

### Project Structure

```
vantaris/
├── frontend/       # Three.js + Vite client
├── backend/        # Colyseus game server
├── shared/         # Shared types and constants
├── Dockerfile      # Backend container image
└── .github/workflows/deploy.yml
```

### Running Locally

```bash
# Start both frontend and backend
npm run dev

# Or run individually
npm run dev:frontend   # http://localhost:5173
npm run dev:backend    # ws://localhost:2567
```

### Running Tests

```bash
npm test
```

## Making Changes

1. Create a branch: `git checkout -b my-feature`
2. Make your changes
3. Add tests if applicable
4. Ensure tests pass: `npm test`
5. Commit with a clear message
6. Push to your fork and open a pull request against `master`

## Code Style

- TypeScript strict mode is enabled across all packages
- Follow existing patterns in the codebase
- No unused imports or variables
- Prefer explicit types over `any`

## Reporting Issues

Open an issue on GitHub with:

- Steps to reproduce
- Expected vs actual behavior
- Browser and Node.js versions
- Console errors or logs

## License

By contributing, you agree that your contributions will be licensed under the Cryptographic Autonomy License 1.0 (Combined Work Exception). See [LICENSE](LICENSE) for details.