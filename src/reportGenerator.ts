import * as vscode from 'vscode';
import * as path from 'path';
import { CodeTracker, TeamCoverageReport, UsageReport } from './codeTracker';

export class ReportGenerator {
    constructor(private codeTracker: CodeTracker) {}

    /**
     * Export usage report as JSON and save to file
     */
    public async exportJsonReport(): Promise<void> {
        const report = this.codeTracker.generateUsageReport();
        const teamCoverage = await this.codeTracker.getTeamCoverage();
        const enrichedReport = {
            ...report,
            branch: this.codeTracker.getCurrentBranch(),
            teamCoverage
        };
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(
                path.join(
                    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
                    `agent-code-tracker-report-${this.getDateStamp()}.json`
                )
            ),
            filters: { 'JSON': ['json'] }
        });

        if (uri) {
            const content = JSON.stringify(enrichedReport, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
            vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
        }
    }

    /**
     * Export usage report as a standalone HTML file
     */
    public async exportHtmlReport(): Promise<void> {
        const report = this.codeTracker.generateUsageReport();
        const teamCoverage = await this.codeTracker.getTeamCoverage();
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(
                path.join(
                    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
                    `agent-code-tracker-report-${this.getDateStamp()}.html`
                )
            ),
            filters: { 'HTML': ['html'] }
        });

        if (uri) {
            const html = this.generateHtmlReport(report, teamCoverage);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(html, 'utf-8'));
            vscode.window.showInformationMessage(`HTML report saved to ${uri.fsPath}`);
        }
    }

    /**
     * Copy report summary to clipboard for quick sharing
     */
    public async copyReportToClipboard(): Promise<void> {
        const report = this.codeTracker.generateUsageReport();
        const teamCoverage = await this.codeTracker.getTeamCoverage();
        const summary = this.generateTextSummary(report, teamCoverage);
        await vscode.env.clipboard.writeText(summary);
        vscode.window.showInformationMessage('Usage report copied to clipboard');
    }

    private getDateStamp(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    private generateTextSummary(report: UsageReport, teamCoverage?: TeamCoverageReport): string {
        const ws = report.workspaceStats;
        const fileEntries = Object.entries(report.fileStats);
        const teamEntries = Object.entries(teamCoverage?.perUser ?? {});
        const lines = [
            `Agent Code Tracker — Usage Report`,
            `Project: ${report.projectName}`,
            `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
            `Branch: ${this.codeTracker.getCurrentBranch()}`,
            ``,
            `=== Workspace Summary ===`,
            `Total Characters: ${ws.totalChars.toLocaleString()}`,
            `Agent Code:       ${ws.agentChars.toLocaleString()} (${ws.percentage.toFixed(1)}%)`,
            `Manual Code:      ${ws.manualChars.toLocaleString()} (${(100 - ws.percentage).toFixed(1)}%)`,
            ``,
            `=== Token Usage (estimated) ===`,
            `Total Tokens:  ${report.totalTokensEstimated.toLocaleString()}`,
            `Agent Tokens:  ${report.agentTokensEstimated.toLocaleString()}`,
            `Manual Tokens: ${report.manualTokensEstimated.toLocaleString()}`,
            ``
        ];

        if (teamCoverage) {
            lines.push(`=== Team Coverage (${teamCoverage.branch}) ===`);
            lines.push(`Users Contributed: ${teamEntries.length}`);
            lines.push(`Overall Team Chars: ${teamCoverage.overall.totalChars.toLocaleString()}`);
            lines.push(`Overall Agent Code: ${teamCoverage.overall.agentChars.toLocaleString()} (${teamCoverage.overall.percentage.toFixed(1)}%)`);
            lines.push(`Overall Manual Code: ${teamCoverage.overall.manualChars.toLocaleString()} (${(100 - teamCoverage.overall.percentage).toFixed(1)}%)`);
            lines.push('');

            if (teamEntries.length > 0) {
                lines.push('Per-User Coverage:');
                for (const [user, stats] of teamEntries) {
                    lines.push(`  ${user}: ${stats.summary.percentage.toFixed(1)}% agent (${stats.summary.totalChars.toLocaleString()} chars)`);
                }
                lines.push('');
            }
        }

        if (fileEntries.length > 0) {
            lines.push(`=== Per-File Breakdown ===`);
            for (const [filePath, stats] of fileEntries) {
                lines.push(`  ${path.basename(filePath)}: ${stats.percentage.toFixed(1)}% agent (${stats.totalChars.toLocaleString()} chars)`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Generate a standalone HTML report that can be shared
     */
    private generateHtmlReport(report: UsageReport, teamCoverage: TeamCoverageReport): string {
        const ws = report.workspaceStats;
        const fileEntries = Object.entries(report.fileStats);
        const teamEntries = Object.entries(teamCoverage.perUser).sort(
            (a, b) => b[1].summary.totalChars - a[1].summary.totalChars
        );

        const fileRows = fileEntries.map(([filePath, stats]) => `
            <tr>
                <td>${this.escapeHtml(path.basename(filePath))}</td>
                <td>${stats.totalChars.toLocaleString()}</td>
                <td>${stats.agentChars.toLocaleString()}</td>
                <td>${stats.manualChars.toLocaleString()}</td>
                <td>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${stats.percentage}%"></div>
                        <span class="bar-label">${stats.percentage.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>`).join('');

        const teamRows = teamEntries.map(([user, stats]) => `
            <tr>
                <td>${this.escapeHtml(user)}</td>
                <td>${stats.summary.totalChars.toLocaleString()}</td>
                <td>${stats.summary.agentChars.toLocaleString()}</td>
                <td>${stats.summary.manualChars.toLocaleString()}</td>
                <td>${stats.summary.percentage.toFixed(1)}%</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Code Tracker Report — ${this.escapeHtml(report.projectName)}</title>
<style>
  :root { --accent: #007acc; --bg: #1e1e1e; --fg: #d4d4d4; --card: #252526; --border: #3c3c3c; }
  @media (prefers-color-scheme: light) { :root { --bg: #fff; --fg: #1e1e1e; --card: #f3f3f3; --border: #e0e0e0; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); padding: 32px; line-height: 1.6; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .card .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .progress { width: 100%; height: 28px; background: var(--card); border-radius: 14px; overflow: hidden; border: 1px solid var(--border); margin: 16px 0; position: relative; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #007acc, #00a8e8); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 13px; min-width: 40px; transition: width 0.3s ease; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
  th { color: #888; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  .bar-container { position: relative; width: 100%; height: 20px; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
  .bar-fill { height: 100%; background: linear-gradient(90deg, #007acc, #00a8e8); min-width: 2px; }
  .bar-label { position: absolute; top: 0; left: 8px; line-height: 20px; font-size: 11px; font-weight: 600; }
  .section { margin-top: 32px; }
  .section h2 { font-size: 18px; margin-bottom: 12px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: #888; }
</style>
</head>
<body>
  <h1>Agent Code Tracker Report</h1>
  <p class="meta">Project: <strong>${this.escapeHtml(report.projectName)}</strong> &middot; Generated: ${new Date(report.generatedAt).toLocaleString()}</p>

  <div class="grid">
    <div class="card"><div class="label">Total Characters</div><div class="value">${ws.totalChars.toLocaleString()}</div></div>
    <div class="card"><div class="label">Agent Code</div><div class="value">${ws.agentChars.toLocaleString()}</div></div>
    <div class="card"><div class="label">Manual Code</div><div class="value">${ws.manualChars.toLocaleString()}</div></div>
    <div class="card"><div class="label">Agent %</div><div class="value">${ws.percentage.toFixed(1)}%</div></div>
  </div>

  <div class="progress">
    <div class="progress-fill" style="width: ${Math.max(ws.percentage, 2)}%">${ws.percentage.toFixed(1)}% Agent</div>
  </div>

  <div class="section">
        <h2>Team Coverage (Branch: ${this.escapeHtml(teamCoverage.branch)})</h2>
        <div class="grid">
            <div class="card"><div class="label">Users Contributed</div><div class="value">${teamEntries.length}</div></div>
            <div class="card"><div class="label">Overall Team Chars</div><div class="value">${teamCoverage.overall.totalChars.toLocaleString()}</div></div>
            <div class="card"><div class="label">Overall Agent</div><div class="value">${teamCoverage.overall.agentChars.toLocaleString()}</div></div>
            <div class="card"><div class="label">Overall Coverage</div><div class="value">${teamCoverage.overall.percentage.toFixed(1)}%</div></div>
        </div>
        ${teamEntries.length === 0 ? '<p style="color:#888">No merged user stats found for this branch yet.</p>' : `
        <table>
            <thead><tr><th>User</th><th>Total</th><th>Agent</th><th>Manual</th><th>Coverage</th></tr></thead>
            <tbody>${teamRows}</tbody>
        </table>`}
    </div>

    <div class="section">
    <h2>Token Usage (Estimated)</h2>
    <div class="grid">
      <div class="card"><div class="label">Total Tokens</div><div class="value">${report.totalTokensEstimated.toLocaleString()}</div></div>
      <div class="card"><div class="label">Agent Tokens</div><div class="value">${report.agentTokensEstimated.toLocaleString()}</div></div>
      <div class="card"><div class="label">Manual Tokens</div><div class="value">${report.manualTokensEstimated.toLocaleString()}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Per-File Breakdown</h2>
    ${fileEntries.length === 0 ? '<p style="color:#888">No file statistics recorded yet.</p>' : `
    <table>
      <thead><tr><th>File</th><th>Total</th><th>Agent</th><th>Manual</th><th>Agent %</th></tr></thead>
      <tbody>${fileRows}</tbody>
    </table>`}
  </div>

  <div class="footer">Generated by Agent Code Tracker VS Code Extension</div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
