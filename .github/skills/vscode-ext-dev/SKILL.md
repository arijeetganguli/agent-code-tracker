---
name: vscode-ext-dev
description: 'Build, test, debug, and package the Agent Code Tracker VS Code extension. Use when: adding features, fixing bugs, running tests, debugging extension host, packaging for distribution, or modifying extension manifest.'
argument-hint: 'Describe the feature, bug fix, or dev task to perform'
---

# VS Code Extension Development Workflow

## When to Use

- Adding a new feature or command to the extension
- Fixing a bug in tracking, UI, or detection logic
- Running or writing tests
- Debugging the extension in the Extension Development Host
- Packaging the extension for distribution
- Modifying `package.json` contributions (commands, configuration, activation)

## Project Architecture

| Module | Responsibility |
|--------|---------------|
| `src/extension.ts` | Activation, command registration, event wiring, disposal |
| `src/codeTracker.ts` | AI vs manual detection heuristics, stats persistence via `workspaceState` |
| `src/statusBar.ts` | Status bar item with 2-second polling updates |
| `src/statsView.ts` | Webview panel with per-file and workspace-wide statistics |
| `src/test/extension.test.ts` | Mocha test suite (run via `@vscode/test-cli`) |

### Key Interfaces

```typescript
// in codeTracker.ts
interface CodeStats { totalChars: number; agentChars: number; manualChars: number; percentage: number; }
interface FileStats { [filePath: string]: CodeStats; }
```

### Dependency Flow

```
extension.ts → creates CodeTracker
             → passes CodeTracker to StatusBarManager
             → passes CodeTracker to StatsViewProvider
```

All disposables are pushed to `context.subscriptions` for cleanup.

## Procedure

### 1. Understand the Change

- Identify which module(s) the change touches (see Architecture table)
- If adding a command: update both `src/extension.ts` (registration) and `package.json` (contributes.commands)
- If adding a config setting: update `package.json` (contributes.configuration) and consume it via `vscode.workspace.getConfiguration('agentCodeTracker')`

### 2. Implement

- Follow existing patterns:
  - **Classes**: PascalCase with descriptive suffixes (`Manager`, `Provider`)
  - **Methods**: camelCase
  - **Interfaces**: PascalCase, exported
  - **Strict mode**: All type annotations explicit
  - **Semicolons**: Required (enforced by ESLint)
- Webview HTML must use VS Code CSS variables (`--vscode-foreground`, `--vscode-editor-background`, etc.)
- Webview communication uses `panel.webview.postMessage()` and `panel.webview.onDidReceiveMessage()`
- All resources (intervals, event listeners, status bar items) must implement disposal

### 3. Type-Check

```sh
npm run check-types
```

Runs `tsc --noEmit` against `tsconfig.json` (strict mode, ES2022 target, Node16 module).

### 4. Lint

```sh
npm run lint
```

Uses ESLint flat config (`eslint.config.mjs`) with TypeScript parser. Key rules: semicolons required, strict equality, camelCase/PascalCase imports.

### 5. Build

```sh
npm run compile          # type-check + lint + esbuild bundle
```

Output: `dist/extension.js` (CommonJS, single-file bundle). `vscode` is external (not bundled).

For watch mode during development:

```sh
npm run watch            # parallel tsc --noEmit --watch + esbuild --watch
```

### 6. Test

```sh
npm run pretest          # compile tests + compile + lint
npm run test             # runs vscode-test (launches Extension Development Host)
```

Tests live in `src/test/` and use Mocha + `assert`. Test files are compiled to `out/` directory separately from the main bundle.

### 7. Debug

Press **F5** in VS Code to launch the Extension Development Host. This uses the built-in launch configuration to:
- Build the extension
- Open a new VS Code window with the extension loaded
- Attach the debugger for breakpoints in `src/` files

### 8. Package for Distribution

```sh
npm run package          # type-check + lint + production esbuild (minified)
```

Then use `vsce package` (install `@vscode/vsce` globally) to create a `.vsix` file.

## Checklist Before Committing

- [ ] `npm run check-types` passes
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] `npm run compile` succeeds (bundle builds)
- [ ] Tested in Extension Development Host (F5)
- [ ] New commands registered in both `extension.ts` and `package.json`
- [ ] New config settings added to `package.json` contributes.configuration
- [ ] All new disposables pushed to `context.subscriptions`
- [ ] Webview HTML uses VS Code CSS variables (no hardcoded colors)
