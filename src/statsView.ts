import * as vscode from 'vscode';
import { CodeTracker, FileStats } from './codeTracker';
import * as path from 'path';

export class StatsViewProvider {
    constructor(private codeTracker: CodeTracker) {}

    /**
     * Show detailed statistics in a webview panel
     */
    public async showStats(context: vscode.ExtensionContext): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'agentCodeTrackerStats',
            'Agent Code Tracker - Statistics',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = '<html><body style="font-family: var(--vscode-font-family); padding: 20px;">Loading statistics...</body></html>';
        await this.renderPanel(panel);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'resetAll':
                        this.handleResetAll();
                        await this.renderPanel(panel);
                        break;
                    case 'resetFile':
                        this.handleResetFile(message.filePath);
                        await this.renderPanel(panel);
                        break;
                    case 'refresh':
                        await this.renderPanel(panel);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    /**
     * Handle reset all statistics
     */
    private handleResetAll(): void {
        vscode.window.showWarningMessage(
            'Are you sure you want to reset all statistics?',
            'Yes',
            'No'
        ).then(answer => {
            if (answer === 'Yes') {
                this.codeTracker.resetAllStats();
                vscode.window.showInformationMessage('All statistics have been reset');
            }
        });
    }

    /**
     * Handle reset file statistics
     */
    private handleResetFile(filePath: string): void {
        this.codeTracker.resetFileStats(filePath);
        vscode.window.showInformationMessage(`Statistics reset for ${path.basename(filePath)}`);
    }

    /**
     * Generate HTML content for the webview
     */
    private async renderPanel(panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.html = await this.getWebviewContent();
    }

    /**
     * Generate HTML content for the webview
     */
    private async getWebviewContent(): Promise<string> {
        const workspaceStats = this.codeTracker.getWorkspaceStats();
        const fileStats = this.codeTracker.getAllFileStats();
        const teamCoverage = await this.codeTracker.getTeamCoverage();
        const teamEntries = Object.entries(teamCoverage.perUser)
            .sort((a, b) => b[1].summary.totalChars - a[1].summary.totalChars);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Code Tracker Statistics</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        h2 {
            color: var(--vscode-foreground);
            margin-top: 30px;
        }
        .summary {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background-color: var(--vscode-input-background);
            padding: 15px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
        }
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        .progress-bar {
            width: 100%;
            height: 30px;
            background-color: var(--vscode-input-background);
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
            border: 1px solid var(--vscode-panel-border);
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #007acc, #00a8e8);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .file-list {
            margin-top: 20px;
        }
        .file-item {
            background-color: var(--vscode-input-background);
            padding: 15px;
            margin: 10px 0;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
        }
        .file-name {
            font-weight: bold;
            color: var(--vscode-foreground);
            margin-bottom: 10px;
        }
        .file-stats {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button-group {
            margin: 20px 0;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .team-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .team-table th,
        .team-table td {
            text-align: left;
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }
        .muted {
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h1>🤖 Agent Code Tracker - Statistics</h1>
    
    <div class="summary">
        <h2>Workspace Summary</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Total Characters</div>
                <div class="stat-value">${workspaceStats.totalChars.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Agent Code</div>
                <div class="stat-value">${workspaceStats.agentChars.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Manual Code</div>
                <div class="stat-value">${workspaceStats.manualChars.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Agent Percentage</div>
                <div class="stat-value">${workspaceStats.percentage.toFixed(1)}%</div>
            </div>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${workspaceStats.percentage}%">
                ${workspaceStats.percentage.toFixed(1)}% Agent Code
            </div>
        </div>
    </div>

    <div class="summary">
        <h2>Team Coverage (Branch: ${this.escapeHtml(teamCoverage.branch)})</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Users Contributed</div>
                <div class="stat-value">${teamEntries.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Team Chars</div>
                <div class="stat-value">${teamCoverage.overall.totalChars.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Team Agent</div>
                <div class="stat-value">${teamCoverage.overall.agentChars.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Coverage</div>
                <div class="stat-value">${teamCoverage.overall.percentage.toFixed(1)}%</div>
            </div>
        </div>
        ${this.generateTeamCoverageHTML(teamEntries)}
    </div>

    <div class="button-group">
        <button onclick="refreshStats()">🔄 Refresh</button>
        <button onclick="resetAllStats()">🗑️ Reset All Statistics</button>
    </div>

    <h2>File Statistics</h2>
    ${this.generateFileListHTML(fileStats)}

    <script>
        const vscode = acquireVsCodeApi();

        function refreshStats() {
            vscode.postMessage({ command: 'refresh' });
        }

        function resetAllStats() {
            vscode.postMessage({ command: 'resetAll' });
        }

        function resetFileStats(filePath) {
            vscode.postMessage({ command: 'resetFile', filePath: filePath });
        }
    </script>
</body>
</html>`;
    }

    private generateTeamCoverageHTML(
        teamEntries: Array<[string, { summary: { totalChars: number; agentChars: number; manualChars: number; percentage: number } }]>
    ): string {
        if (teamEntries.length === 0) {
            return '<p class="muted">No merged user stats found for this branch yet. Commit and merge .agent-tracker/users/*.json files to see team coverage.</p>';
        }

        const rows = teamEntries.map(([username, stats]) => `
            <tr>
                <td>${this.escapeHtml(username)}</td>
                <td>${stats.summary.totalChars.toLocaleString()}</td>
                <td>${stats.summary.agentChars.toLocaleString()}</td>
                <td>${stats.summary.manualChars.toLocaleString()}</td>
                <td>${stats.summary.percentage.toFixed(1)}%</td>
            </tr>
        `).join('');

        return `
            <table class="team-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Total</th>
                        <th>Agent</th>
                        <th>Manual</th>
                        <th>Coverage</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    /**
     * Generate HTML for file list
     */
    private generateFileListHTML(fileStats: FileStats): string {
        const entries = Object.entries(fileStats);

        if (entries.length === 0) {
            return '<div class="empty-state">No statistics available yet. Start coding to see statistics!</div>';
        }

        return `<div class="file-list">
            ${entries.map(([filePath, stats]) => `
                <div class="file-item">
                    <div class="file-name">${path.basename(filePath)}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.percentage}%">
                            ${stats.percentage.toFixed(1)}%
                        </div>
                    </div>
                    <div class="file-stats">
                        <span>Total: ${stats.totalChars.toLocaleString()}</span>
                        <span>Agent: ${stats.agentChars.toLocaleString()}</span>
                        <span>Manual: ${stats.manualChars.toLocaleString()}</span>
                    </div>
                    <button onclick="resetFileStats('${filePath.replace(/\\/g, '\\\\')}')">Reset</button>
                </div>
            `).join('')}
        </div>`;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
