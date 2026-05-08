import * as vscode from 'vscode';
import { StatsStorage, TeamStatsResult } from './statsStorage';

export interface CodeStats {
    totalChars: number;
    agentChars: number;
    manualChars: number;
    percentage: number;
}

export interface TokenUsage {
    timestamp: string;
    filePath: string;
    tokensEstimated: number;
    changeType: 'agent' | 'manual';
}

export interface UsageReport {
    projectName: string;
    generatedAt: string;
    workspaceStats: CodeStats;
    fileStats: FileStats;
    tokenUsage: TokenUsage[];
    totalTokensEstimated: number;
    agentTokensEstimated: number;
    manualTokensEstimated: number;
}

export interface TeamCoverageReport {
    branch: string;
    perUser: TeamStatsResult['perUser'];
    overall: CodeStats;
}

export interface FileStats {
    [filePath: string]: CodeStats;
}

export class CodeTracker {
    private fileStats: FileStats = {};
    private tokenUsage: TokenUsage[] = [];
    private isTrackingAgentCode: boolean = false;
    private lastChangeWasAgent: boolean = false;
    private storage: StatsStorage;
    private initialized: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = new StatsStorage();
        this.loadStats();
    }

    /**
     * Check if tracking is enabled based on configuration
     */
    public isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('agentCodeTracker');
        return config.get<boolean>('enabled', true);
    }

    /**
     * Start tracking document changes
     */
    public startTracking(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Track text document changes
        disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                this.handleDocumentChange(event);
            })
        );

        // Track when documents are opened to initialize stats
        disposables.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                this.initializeFileStats(document);
            })
        );

        return disposables;
    }

    /**
     * Initialize statistics for a document
     */
    private initializeFileStats(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath;
        
        // Only initialize if not already tracked
        if (!this.fileStats[filePath]) {
            const currentLength = document.getText().length;
            const config = vscode.workspace.getConfiguration('agentCodeTracker', document.uri);
            const basePct = config.get<number>('baseAgentPercentage', 0);
            const agentChars = Math.round(currentLength * (basePct / 100));
            const manualChars = currentLength - agentChars;
            const percentage = currentLength > 0 ? basePct : 0;
            this.fileStats[filePath] = {
                totalChars: currentLength,
                agentChars,
                manualChars,
                percentage
            };
            this.saveStats();
        }
    }

    /**
     * Handle document changes and track if it's agent or manual code
     */
    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (!this.isEnabled()) {
            return;
        }

        const document = event.document;
        const filePath = document.uri.fsPath;

        // Skip untitled and non-file documents
        if (document.uri.scheme !== 'file') {
            return;
        }

        // Initialize stats for new files
        if (!this.fileStats[filePath]) {
            this.initializeFileStats(document);
        }

        // Process each content change
        event.contentChanges.forEach(change => {
            const changeLength = change.text.length;
            const deletionLength = change.rangeLength;

            // Determine if this change is from an agent
            const isAgentCode = this.detectAgentCode(change);

            if (deletionLength > 0) {
                // Text was deleted - we need to determine what type of code was deleted
                // For simplicity, we'll proportionally reduce agent and manual chars
                const stats = this.fileStats[filePath];
                const totalChars = stats.totalChars;
                
                if (totalChars > 0) {
                    const agentRatio = stats.agentChars / totalChars;
                    const manualRatio = stats.manualChars / totalChars;
                    
                    stats.agentChars = Math.max(0, stats.agentChars - (deletionLength * agentRatio));
                    stats.manualChars = Math.max(0, stats.manualChars - (deletionLength * manualRatio));
                    stats.totalChars = Math.max(0, stats.totalChars - deletionLength);
                }
            }

            if (changeLength > 0) {
                // Text was added
                const changeType: 'agent' | 'manual' = isAgentCode ? 'agent' : 'manual';
                if (isAgentCode) {
                    this.fileStats[filePath].agentChars += changeLength;
                } else {
                    this.fileStats[filePath].manualChars += changeLength;
                }
                this.fileStats[filePath].totalChars += changeLength;

                // Track token usage (rough estimate: ~4 chars per token)
                const tokensEstimated = Math.ceil(changeLength / 4);
                this.tokenUsage.push({
                    timestamp: new Date().toISOString(),
                    filePath,
                    tokensEstimated,
                    changeType
                });

                // Buffer to file-based log
                this.storage.appendTokenLog({
                    ts: new Date().toISOString(),
                    file: this.storage.toRelativePath(filePath),
                    tokens: tokensEstimated,
                    type: changeType
                });
            }

            // Update percentage
            this.updatePercentage(filePath);
        });

        this.saveStats();
    }

    /**
     * Detect if the code change is from an AI agent using various heuristics
     */
    private detectAgentCode(change: vscode.TextDocumentContentChangeEvent): boolean {
        const text = change.text;
        const textLength = text.length;

        // Ignore very small changes (single character typing)
        if (textLength <= 1) {
            this.lastChangeWasAgent = false;
            return false;
        }

        // Heuristic 1: Large insertions (more than 30 characters at once)
        // This is a strong indicator of AI-generated code
        if (textLength > 30) {
            this.lastChangeWasAgent = true;
            return true;
        }

        // Heuristic 2: Multiple complete lines of code at once
        if (text.includes('\n')) {
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            if (lines.length >= 2 && textLength > 20) {
                this.lastChangeWasAgent = true;
                return true;
            }
        }

        // Heuristic 3: Common code patterns that suggest AI completion
        const codePatterns = [
            /function\s+\w+\s*\([^)]*\)\s*{/,  // function definitions
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>/,  // arrow functions
            /class\s+\w+\s*{/,           // class definitions
            /interface\s+\w+\s*{/,       // interface definitions
            /\/\*\*[\s\S]*?\*\//,        // JSDoc comments
            /^\s*\/\/.{20,}/,            // Long single-line comments
            /=>\s*{[\s\S]+}/,            // Arrow function bodies
        ];

        for (const pattern of codePatterns) {
            if (pattern.test(text)) {
                this.lastChangeWasAgent = true;
                return true;
            }
        }

        // Heuristic 4: Quick follow-up after agent code (within same editing session)
        if (this.lastChangeWasAgent && textLength > 5) {
            // This could be a continuation, but be less aggressive
            return textLength > 15;
        }

        // Default: assume manual code for smaller changes
        this.lastChangeWasAgent = false;
        return false;
    }

    /**
     * Update the percentage calculation for a file
     */
    private updatePercentage(filePath: string): void {
        const stats = this.fileStats[filePath];
        if (stats.totalChars > 0) {
            stats.percentage = (stats.agentChars / stats.totalChars) * 100;
        } else {
            stats.percentage = 0;
        }
    }

    /**
     * Get statistics for a specific file
     */
    public getFileStats(filePath: string): CodeStats | undefined {
        return this.fileStats[filePath];
    }

    /**
     * Get statistics for the current workspace
     */
    public getWorkspaceStats(): CodeStats {
        let totalChars = 0;
        let agentChars = 0;
        let manualChars = 0;

        Object.values(this.fileStats).forEach(stats => {
            totalChars += stats.totalChars;
            agentChars += stats.agentChars;
            manualChars += stats.manualChars;
        });

        const percentage = totalChars > 0 ? (agentChars / totalChars) * 100 : 0;

        return {
            totalChars,
            agentChars,
            manualChars,
            percentage
        };
    }

    /**
     * Get all file statistics
     */
    public getAllFileStats(): FileStats {
        return { ...this.fileStats };
    }

    /**
     * Get token usage log
     */
    public getTokenUsage(): TokenUsage[] {
        return [...this.tokenUsage];
    }

    /**
     * Generate a shareable usage report
     */
    public generateUsageReport(): UsageReport {
        const workspaceStats = this.getWorkspaceStats();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const projectName = workspaceFolders?.[0]?.name ?? 'Unknown Project';

        let agentTokens = 0;
        let manualTokens = 0;
        for (const entry of this.tokenUsage) {
            if (entry.changeType === 'agent') {
                agentTokens += entry.tokensEstimated;
            } else {
                manualTokens += entry.tokensEstimated;
            }
        }

        return {
            projectName,
            generatedAt: new Date().toISOString(),
            workspaceStats,
            fileStats: this.getAllFileStats(),
            tokenUsage: this.getTokenUsage(),
            totalTokensEstimated: agentTokens + manualTokens,
            agentTokensEstimated: agentTokens,
            manualTokensEstimated: manualTokens
        };
    }

    /**
     * Reset statistics for a specific file
     */
    public resetFileStats(filePath: string): void {
        delete this.fileStats[filePath];
        this.saveStats();
    }

    /**
     * Reset all statistics
     */
    public resetAllStats(): void {
        this.fileStats = {};
        this.tokenUsage = [];
        this.saveStats();
    }

    /**
     * Save statistics to project file (debounced) and workspace state (immediate fallback)
     */
    private saveStats(): void {
        this.context.workspaceState.update('codeTrackerStats', this.fileStats);
        this.context.workspaceState.update('codeTrackerTokenUsage', this.tokenUsage);
        this.storage.scheduleSave(this.fileStats, this.tokenUsage);
    }

    /**
     * Force flush all pending writes to disk (call on deactivate)
     */
    public async flushStats(): Promise<void> {
        await this.storage.flushSave(this.fileStats, this.tokenUsage);
    }

    /**
     * Load statistics from project file, falling back to workspace state
     */
    private loadStats(): void {
        // Synchronously load from workspaceState first (fast)
        const savedStats = this.context.workspaceState.get<FileStats>('codeTrackerStats');
        if (savedStats) {
            this.fileStats = savedStats;
        }
        const savedTokens = this.context.workspaceState.get<TokenUsage[]>('codeTrackerTokenUsage');
        if (savedTokens) {
            this.tokenUsage = savedTokens;
        }

        // Then async load from project file (may override with newer data)
        this.loadFromProjectFile();
    }

    /**
     * Async load from .agent-tracker project files
     */
    private async loadFromProjectFile(): Promise<void> {
        try {
            const { fileStats, tokenUsage } = await this.storage.loadUserStats();
            if (Object.keys(fileStats).length > 0) {
                this.fileStats = fileStats;
                this.tokenUsage = tokenUsage;
                this.context.workspaceState.update('codeTrackerStats', this.fileStats);
                this.context.workspaceState.update('codeTrackerTokenUsage', this.tokenUsage);
                this.initialized = true;
            }
            // Set up .gitattributes for merge-friendly logs
            await this.storage.ensureGitAttributes();
        } catch {
            // Project file not available, workspaceState is the fallback
        }
    }

    /**
     * Load all users' stats (merged team view)
     */
    public async getTeamStats(): Promise<{
        perUser: { [username: string]: { fileStats: FileStats } };
        merged: FileStats;
    }> {
        const team = await this.storage.loadAllUsersStats();
        const simplified: { [username: string]: { fileStats: FileStats } } = {};
        for (const [username, stats] of Object.entries(team.perUser)) {
            simplified[username] = { fileStats: stats.fileStats };
        }

        return {
            perUser: simplified,
            merged: team.merged
        };
    }

    /**
     * Get branch-aware team coverage summary (per-user + overall)
     */
    public async getTeamCoverage(branch?: string): Promise<TeamCoverageReport> {
        const team = await this.storage.loadAllUsersStats(branch);
        return {
            branch: team.branch,
            perUser: team.perUser,
            overall: team.overall
        };
    }

    public getCurrentBranch(): string {
        return this.storage.getCurrentBranch();
    }

    /**
     * Get the storage helper (for report generation with relative paths)
     */
    public getStorage(): StatsStorage {
        return this.storage;
    }
}
