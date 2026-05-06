import * as vscode from 'vscode';
import { CodeTracker } from './codeTracker';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private updateInterval: NodeJS.Timeout | undefined;

    constructor(
        private codeTracker: CodeTracker,
        private context: vscode.ExtensionContext
    ) {
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'agent-code-tracker.showStats';
        this.context.subscriptions.push(this.statusBarItem);
        
        // Show initial stats
        this.updateStatusBar();
        this.statusBarItem.show();

        // Update status bar every 2 seconds for more responsive feedback
        this.updateInterval = setInterval(() => {
            this.updateStatusBar();
        }, 2000);
    }

    /**
     * Update the status bar with current statistics
     */
    private updateStatusBar(): void {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor) {
            const filePath = activeEditor.document.uri.fsPath;
            const fileStats = this.codeTracker.getFileStats(filePath);
            
            if (fileStats) {
                const percentage = fileStats.percentage.toFixed(1);
                this.statusBarItem.text = `$(robot) Agent: ${percentage}%`;
                this.statusBarItem.tooltip = this.getTooltipText(fileStats);
            } else {
                this.statusBarItem.text = `$(robot) Agent: 0%`;
                this.statusBarItem.tooltip = 'No statistics available for this file';
            }
        } else {
            // Show workspace stats when no file is open
            const workspaceStats = this.codeTracker.getWorkspaceStats();
            const percentage = workspaceStats.percentage.toFixed(1);
            this.statusBarItem.text = `$(robot) Agent: ${percentage}%`;
            this.statusBarItem.tooltip = this.getTooltipText(workspaceStats);
        }
    }

    /**
     * Generate tooltip text for status bar
     */
    private getTooltipText(stats: { totalChars: number; agentChars: number; manualChars: number; percentage: number }): string {
        return `Agent Code Tracker
━━━━━━━━━━━━━━━━━━━━
Total Characters: ${stats.totalChars.toLocaleString()}
Agent Code: ${stats.agentChars.toLocaleString()} (${stats.percentage.toFixed(1)}%)
Manual Code: ${stats.manualChars.toLocaleString()} (${(100 - stats.percentage).toFixed(1)}%)

Click to view detailed statistics`;
    }

    /**
     * Force update of the status bar
     */
    public update(): void {
        this.updateStatusBar();
    }

    /**
     * Dispose of the status bar manager
     */
    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.statusBarItem.dispose();
    }
}
