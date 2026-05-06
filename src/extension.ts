import * as vscode from 'vscode';
import { CodeTracker } from './codeTracker';
import { StatusBarManager } from './statusBar';
import { StatsViewProvider } from './statsView';
import { ReportGenerator } from './reportGenerator';

let codeTracker: CodeTracker;
let statusBarManager: StatusBarManager;
let statsViewProvider: StatsViewProvider;
let reportGenerator: ReportGenerator;

export function activate(context: vscode.ExtensionContext) {
	console.log('Agent Code Tracker is now active!');

	// Initialize the code tracker
	codeTracker = new CodeTracker(context);
	
	// Start tracking code changes
	const trackingDisposables = codeTracker.startTracking();
	trackingDisposables.forEach(disposable => context.subscriptions.push(disposable));

	// Initialize the status bar manager
	statusBarManager = new StatusBarManager(codeTracker, context);

	// Initialize the stats view provider
	statsViewProvider = new StatsViewProvider(codeTracker);

	// Initialize the report generator
	reportGenerator = new ReportGenerator(codeTracker);

	// Register command to show statistics
	const showStatsCommand = vscode.commands.registerCommand('agent-code-tracker.showStats', () => {
		statsViewProvider.showStats(context);
	});
	context.subscriptions.push(showStatsCommand);

	// Register command to reset all statistics
	const resetStatsCommand = vscode.commands.registerCommand('agent-code-tracker.resetStats', () => {
		vscode.window.showWarningMessage(
			'Are you sure you want to reset all statistics?',
			'Yes',
			'No'
		).then(answer => {
			if (answer === 'Yes') {
				codeTracker.resetAllStats();
				statusBarManager.update();
				vscode.window.showInformationMessage('All statistics have been reset');
			}
		});
	});
	context.subscriptions.push(resetStatsCommand);

	// Register command to reset current file statistics
	const resetFileStatsCommand = vscode.commands.registerCommand('agent-code-tracker.resetFileStats', () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const filePath = activeEditor.document.uri.fsPath;
			codeTracker.resetFileStats(filePath);
			statusBarManager.update();
			vscode.window.showInformationMessage('File statistics have been reset');
		}
	});
	context.subscriptions.push(resetFileStatsCommand);

	// Register command to export JSON report
	const exportJsonCommand = vscode.commands.registerCommand('agent-code-tracker.exportJsonReport', () => {
		reportGenerator.exportJsonReport();
	});
	context.subscriptions.push(exportJsonCommand);

	// Register command to export HTML report
	const exportHtmlCommand = vscode.commands.registerCommand('agent-code-tracker.exportHtmlReport', () => {
		reportGenerator.exportHtmlReport();
	});
	context.subscriptions.push(exportHtmlCommand);

	// Register command to copy report to clipboard
	const copyReportCommand = vscode.commands.registerCommand('agent-code-tracker.copyReport', () => {
		reportGenerator.copyReportToClipboard();
	});
	context.subscriptions.push(copyReportCommand);

	// Update status bar when active editor changes
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
		statusBarManager.update();
	});
	context.subscriptions.push(editorChangeDisposable);

	// Update status bar when document content changes
	const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(() => {
		statusBarManager.update();
	});
	context.subscriptions.push(documentChangeDisposable);

	vscode.window.showInformationMessage('Agent Code Tracker is ready to track your code!');
}

export function deactivate() {
	if (codeTracker) {
		codeTracker.flushStats();
	}
	if (statusBarManager) {
		statusBarManager.dispose();
	}
}
