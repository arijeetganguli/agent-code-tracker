import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { CodeStats, FileStats, TokenUsage } from './codeTracker';

/**
 * On-disk format stored per user in `.agent-tracker/users/<username>.json`
 * Uses relative paths so stats are portable across machines.
 */
export interface UserStatsFile {
    version: 2;
    user: string;
    machine: string;
    lastUpdated: string;
    fileStats: { [relativePath: string]: CodeStats };
}

/**
 * Append-only token log line (JSONL) in `.agent-tracker/logs/<username>.jsonl`
 */
export interface TokenLogEntry {
    ts: string;
    file: string;          // relative path
    tokens: number;
    type: 'agent' | 'manual';
}

const TRACKER_DIR = '.agent-tracker';
const USERS_DIR = 'users';
const LOGS_DIR = 'logs';

export class StatsStorage {
    private workspaceRoot: string | undefined;
    private username: string;
    private pendingLogLines: string[] = [];
    private saveTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.username = os.userInfo().username || 'unknown';
    }

    /**
     * Get the .agent-tracker directory path
     */
    private getTrackerDir(): string | undefined {
        if (!this.workspaceRoot) { return undefined; }
        return path.join(this.workspaceRoot, TRACKER_DIR);
    }

    /**
     * Convert absolute file path to workspace-relative using forward slashes
     */
    public toRelativePath(absolutePath: string): string {
        if (!this.workspaceRoot) { return absolutePath; }
        const rel = path.relative(this.workspaceRoot, absolutePath);
        return rel.split(path.sep).join('/');
    }

    /**
     * Convert workspace-relative path back to absolute
     */
    public toAbsolutePath(relativePath: string): string {
        if (!this.workspaceRoot) { return relativePath; }
        return path.join(this.workspaceRoot, ...relativePath.split('/'));
    }

    /**
     * Ensure the tracker directories exist
     */
    private async ensureDirs(): Promise<boolean> {
        const trackerDir = this.getTrackerDir();
        if (!trackerDir) { return false; }

        const usersDir = path.join(trackerDir, USERS_DIR);
        const logsDir = path.join(trackerDir, LOGS_DIR);

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(usersDir));
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(logsDir));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Save current user's stats to `.agent-tracker/users/<username>.json`
     */
    public async saveUserStats(fileStats: FileStats, tokenUsage: TokenUsage[]): Promise<void> {
        if (!await this.ensureDirs()) { return; }

        const trackerDir = this.getTrackerDir()!;

        // Convert absolute paths to relative for the stats file
        const relativeStats: { [key: string]: CodeStats } = {};
        for (const [absPath, stats] of Object.entries(fileStats)) {
            const relPath = this.toRelativePath(absPath);
            // Skip paths outside the workspace (e.g., extension host files)
            if (!relPath.startsWith('..')) {
                relativeStats[relPath] = stats;
            }
        }

        const userFile: UserStatsFile = {
            version: 2,
            user: this.username,
            machine: os.hostname(),
            lastUpdated: new Date().toISOString(),
            fileStats: relativeStats
        };

        const filePath = path.join(trackerDir, USERS_DIR, `${this.username}.json`);
        const content = JSON.stringify(userFile, null, 2) + '\n';
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content, 'utf-8')
        );

        // Flush pending token log lines
        if (this.pendingLogLines.length > 0) {
            const logPath = path.join(trackerDir, LOGS_DIR, `${this.username}.jsonl`);
            const logContent = this.pendingLogLines.join('');
            this.pendingLogLines = [];

            try {
                // Append to existing log
                const existing = await this.readFileText(logPath);
                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(logPath),
                    Buffer.from(existing + logContent, 'utf-8')
                );
            } catch {
                // File doesn't exist yet
                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(logPath),
                    Buffer.from(logContent, 'utf-8')
                );
            }
        }
    }

    /**
     * Buffer a token log entry (flushed on next saveUserStats)
     */
    public appendTokenLog(entry: TokenLogEntry): void {
        this.pendingLogLines.push(JSON.stringify(entry) + '\n');
    }

    /**
     * Debounced save — batches rapid changes into a single write
     */
    public scheduleSave(fileStats: FileStats, tokenUsage: TokenUsage[]): void {
        if (this.saveTimer) { clearTimeout(this.saveTimer); }
        this.saveTimer = setTimeout(() => {
            this.saveUserStats(fileStats, tokenUsage);
        }, 2000);
    }

    /**
     * Force an immediate save (call on deactivate)
     */
    public async flushSave(fileStats: FileStats, tokenUsage: TokenUsage[]): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
        }
        await this.saveUserStats(fileStats, tokenUsage);
    }

    /**
     * Load this user's stats from disk, returns absolute-path keyed FileStats
     */
    public async loadUserStats(): Promise<{ fileStats: FileStats; tokenUsage: TokenUsage[] }> {
        const trackerDir = this.getTrackerDir();
        if (!trackerDir) { return { fileStats: {}, tokenUsage: [] }; }

        const filePath = path.join(trackerDir, USERS_DIR, `${this.username}.json`);
        try {
            const text = await this.readFileText(filePath);
            const data = JSON.parse(text) as UserStatsFile;

            // Convert relative paths back to absolute
            const fileStats: FileStats = {};
            for (const [relPath, stats] of Object.entries(data.fileStats)) {
                const absPath = this.toAbsolutePath(relPath);
                fileStats[absPath] = stats;
            }

            // Load token log
            const tokenUsage = await this.loadTokenLog();

            return { fileStats, tokenUsage };
        } catch {
            return { fileStats: {}, tokenUsage: [] };
        }
    }

    /**
     * Load token log from JSONL file
     */
    private async loadTokenLog(): Promise<TokenUsage[]> {
        const trackerDir = this.getTrackerDir();
        if (!trackerDir) { return []; }

        const logPath = path.join(trackerDir, LOGS_DIR, `${this.username}.jsonl`);
        try {
            const text = await this.readFileText(logPath);
            const entries: TokenUsage[] = [];
            for (const line of text.split('\n')) {
                if (!line.trim()) { continue; }
                try {
                    const entry = JSON.parse(line) as TokenLogEntry;
                    entries.push({
                        timestamp: entry.ts,
                        filePath: this.toAbsolutePath(entry.file),
                        tokensEstimated: entry.tokens,
                        changeType: entry.type
                    });
                } catch {
                    // Skip malformed lines
                }
            }
            return entries;
        } catch {
            return [];
        }
    }

    /**
     * Read all users' stats and merge into a combined view.
     * Used for team-wide reporting.
     */
    public async loadAllUsersStats(): Promise<{
        perUser: { [username: string]: { fileStats: FileStats } };
        merged: FileStats;
    }> {
        const trackerDir = this.getTrackerDir();
        if (!trackerDir) {
            return { perUser: {}, merged: {} };
        }

        const usersDir = path.join(trackerDir, USERS_DIR);
        const perUser: { [username: string]: { fileStats: FileStats } } = {};
        const merged: FileStats = {};

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(usersDir));
            for (const [fileName, fileType] of entries) {
                if (fileType !== vscode.FileType.File || !fileName.endsWith('.json')) {
                    continue;
                }

                try {
                    const text = await this.readFileText(path.join(usersDir, fileName));
                    const data = JSON.parse(text) as UserStatsFile;
                    const userStats: FileStats = {};

                    for (const [relPath, stats] of Object.entries(data.fileStats)) {
                        const absPath = this.toAbsolutePath(relPath);
                        userStats[absPath] = stats;

                        // Merge: sum up all users' contributions per file
                        if (!merged[absPath]) {
                            merged[absPath] = { totalChars: 0, agentChars: 0, manualChars: 0, percentage: 0 };
                        }
                        merged[absPath].totalChars += stats.totalChars;
                        merged[absPath].agentChars += stats.agentChars;
                        merged[absPath].manualChars += stats.manualChars;
                    }

                    perUser[data.user] = { fileStats: userStats };
                } catch {
                    // Skip corrupt user files
                }
            }

            // Recalculate percentages on merged stats
            for (const stats of Object.values(merged)) {
                stats.percentage = stats.totalChars > 0
                    ? (stats.agentChars / stats.totalChars) * 100
                    : 0;
            }
        } catch {
            // Users directory doesn't exist yet
        }

        return { perUser, merged };
    }

    /**
     * Write .gitattributes entry for merge=union on tracker files
     * so git auto-merges without conflicts
     */
    public async ensureGitAttributes(): Promise<void> {
        if (!this.workspaceRoot) { return; }

        const gaPath = path.join(this.workspaceRoot, '.gitattributes');
        const markerLine = '.agent-tracker/logs/*.jsonl merge=union';

        try {
            const existing = await this.readFileText(gaPath);
            if (existing.includes(markerLine)) { return; }
            const updated = existing.trimEnd() + '\n' + markerLine + '\n';
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(gaPath),
                Buffer.from(updated, 'utf-8')
            );
        } catch {
            // .gitattributes doesn't exist, create it
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(gaPath),
                Buffer.from(markerLine + '\n', 'utf-8')
            );
        }
    }

    private async readFileText(filePath: string): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        return Buffer.from(bytes).toString('utf-8');
    }

    public getUsername(): string {
        return this.username;
    }
}
