# Agent Code Tracker

Track and calculate the percentage of code written by AI agents (like GitHub Copilot) versus manual code contributions in your VS Code workspace.

## 🎯 Features

- **Real-time Change Tracking**: Monitors document edits as you code and classifies changes as agent or manual
- **Heuristic Agent Detection**: Identifies likely AI-generated insertions using size, structure, and code-pattern heuristics
- **Workspace and File-Level Analytics**: Tracks totals, agent/manual character counts, and percentages per file and across the project
- **Branch-Aware Team Tracking**: Preserves per-user stats by branch and aggregates them after merges
- **Per-User + Overall Coverage**: Shows contributor-level coverage and combined team coverage for the active branch
- **Status Bar Insights**: Shows current file attribution percentage with quick access to detailed stats
- **Interactive Statistics Dashboard**: Displays summary cards, progress bars, and per-file breakdown in a webview
- **Report Sharing**: Export usage reports as JSON or standalone HTML, or copy a text summary to clipboard
- **Token Usage Estimation**: Estimates token consumption per change and includes token totals in reports
- **Persistent Project Data**: Stores tracking data across sessions so historical attribution is preserved
- **Flexible Baseline Support**: Optionally apply a base AI percentage when first tracking existing files
- **Reset Controls**: Reset statistics for the current file or the entire workspace

## 📊 How It Works

The extension uses multiple heuristics to detect AI-generated code:

1. **Large Insertions**: Code blocks with more than 30 characters inserted at once
2. **Multi-line Code**: Complete lines of code with proper indentation
3. **Code Patterns**: Common patterns like function definitions, classes, interfaces, and JSDoc comments
4. **Sequential Detection**: Consecutive quick insertions from the same source

## 🚀 Getting Started

1. Install the extension
2. Start coding in any file
3. The status bar will show the percentage of agent-generated code
4. Click the status bar item to view detailed statistics

## 📝 Commands

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and use:

- **Agent Code Tracker: Show Statistics** - Opens a detailed view of all statistics
- **Agent Code Tracker: Reset All Statistics** - Resets statistics for all files
- **Agent Code Tracker: Reset Current File Statistics** - Resets statistics for the active file
- **Agent Code Tracker: Export Report (JSON)** - Saves a machine-readable usage report
- **Agent Code Tracker: Export Report (HTML)** - Saves a shareable visual report
- **Agent Code Tracker: Copy Report to Clipboard** - Copies a plain-text summary for quick sharing

## ⚙️ Extension Settings

This extension contributes the following settings:

- `agentCodeTracker.enabled`: Enable/disable agent code tracking (default: `true`)
- `agentCodeTracker.minCharsForAgent`: Minimum characters inserted at once to consider it agent-generated (default: `30`)
- `agentCodeTracker.showStatusBar`: Show/hide the status bar item (default: `true`)
- `agentCodeTracker.baseAgentPercentage`: Baseline AI attribution for pre-existing file content on first track (default: `0`)
- `agentCodeTracker.trackTokenUsage`: Enable/disable estimated token usage tracking (default: `true`)

## 🎨 Status Bar

The status bar item displays:
- 🤖 Icon indicating agent code tracking
- Current percentage of agent-generated code
- Click to open detailed statistics view

**Tooltip shows:**
- Total characters
- Agent code count and percentage
- Manual code count and percentage

## 📈 Statistics View

The statistics view provides:
- **Workspace Summary**: Overall statistics across all tracked files
- **Progress Bar**: Visual representation of agent vs manual code
- **File List**: Detailed breakdown for each file
- **Refresh**: Update statistics in real-time
- **Reset Options**: Reset statistics per file or for entire workspace

## 🔧 Development

### Running the Extension

1. Open this folder in VS Code
2. Press `F5` to open a new window with the extension loaded
3. Start coding and watch the statistics update in real-time
4. Open the Command Palette and run "Agent Code Tracker: Show Statistics"

### Making Changes

1. Modify the code in the `src` folder
2. Run `npm run compile` to rebuild
3. Reload the extension window (`Ctrl+R` or `Cmd+R`)

### Building

```bash
npm run compile        # Compile TypeScript
npm run watch          # Watch mode for development
npm run package        # Build for production
```

## 📦 Project Structure

```
agent-code-tracker/
├── src/
│   ├── extension.ts       # Main extension entry point
│   ├── codeTracker.ts     # Core tracking logic
│   ├── statusBar.ts       # Status bar management
│   └── statsView.ts       # Statistics webview
├── package.json           # Extension manifest
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## 🤝 Contributing

Contributions are welcome! The extension uses:
- TypeScript for type safety
- VS Code Extension API
- esbuild for fast bundling

## 📄 License

This extension is provided as-is for tracking code authorship in development environments.

## 🐛 Known Issues

- Detection heuristics may not be 100% accurate
- Some edge cases might misclassify code origin
- Large paste operations might be detected as agent code

## 📝 Release Notes

### 0.0.1

Initial release of Agent Code Tracker:
- Real-time code tracking
- Status bar integration
- Detailed statistics view
- Per-file and workspace-wide analytics
- Configurable settings

---

**Enjoy tracking your code authorship!** 🎉


## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
