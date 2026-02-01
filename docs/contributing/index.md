# How to Contribute

Thank you for your interest in contributing to Zequel. Whether you are fixing a bug, proposing a feature, or improving the documentation, every contribution is valued.

## Ways to Contribute

- **Bug reports** -- Open an issue on [GitHub](https://github.com/zequel-labs/zequel/issues) with a clear description, steps to reproduce, and your environment details (OS, Node version, database engine).
- **Feature requests** -- Open an issue describing the feature, the use case, and how you envision it working.
- **Pull requests** -- Fix bugs, implement features, or improve docs. See the pull request workflow below.
- **Documentation** -- Improve or expand the docs you are reading right now. Docs live in the `docs/` directory and are built with VitePress.

## Code of Conduct

All participants are expected to treat each other with respect. Harassment, discrimination, and abusive behavior will not be tolerated.

## Pull Request Workflow

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/zequel.git
   cd zequel
   npm install
   ```
3. **Create a branch** from `main`:
   ```bash
   git checkout -b my-feature main
   ```
4. **Make your changes.** Follow the [coding guidelines](./coding-guidelines) and keep commits focused.
5. **Run typecheck and tests** before pushing:
   ```bash
   npm run typecheck
   npm test
   ```
6. **Push** your branch to your fork:
   ```bash
   git push origin my-feature
   ```
7. **Open a pull request** against `main` on the upstream repository. Describe what changed and why.

A maintainer will review your PR. CI runs typecheck and unit tests automatically on every pull request.

## Getting Started

Head to the [Development Setup](./development-setup) guide to get the project running locally.
