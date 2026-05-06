# Agent Code Tracker - VS Code Extension Development

## Progress Checklist

- [x] Verify that the copilot-instructions.md file in the .github directory is created
- [x] Clarify Project Requirements - Building a VS Code extension to track percentage of code written by AI agents
- [x] Scaffold the Project - Creating VS Code extension structure with TypeScript
- [x] Customize the Project - Implement core tracking functionality
- [x] Install Required Extensions - No additional extensions needed
- [x] Compile the Project - Successfully compiled with esbuild
- [ ] Create and Run Task - Optional for testing
- [ ] Launch the Project - Press F5 to debug the extension
- [x] Ensure Documentation is Complete - README.md updated with comprehensive information

## Project Overview
VS Code extension to track and calculate the percentage of code written by AI agents (like GitHub Copilot) versus manual code contributions.

## Key Features
- Monitor code changes in real-time
- Detect AI-generated vs manual code
- Track statistics per file and workspace-wide
- Display percentage in status bar
- Provide detailed statistics view

## Project Structure
- `src/extension.ts` - Main extension activation and command registration
- `src/codeTracker.ts` - Core tracking logic with smart detection heuristics
- `src/statusBar.ts` - Status bar item management
- `src/statsView.ts` - Webview for detailed statistics display

## Next Steps
1. Press F5 to launch the extension in debug mode
2. Test the extension in a new VS Code window
3. Start coding to see statistics update in real-time
4. Use Command Palette to view detailed statistics

