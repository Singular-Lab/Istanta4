import fs from 'fs';
import path from 'path';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { log } from '../logger';

// Interfacce per i tipi di log
export interface LogAuditFile {
    date: number;
    name: string;
    hash: string;
}

export interface LogAudit {
    keep: {
        days: boolean;
        amount: number;
    };
    auditLog: string;
    files: LogAuditFile[];
    hashType: string;
}

export interface LogFileInfo {
    name: string;
    size: number;
    created: Date;
    modified: Date;
    type: 'application' | 'error' | 'other';
    hash?: string;
    fromAudit: boolean;
}

export interface LogSearchResult {
    file: string;
    line: number;
    entry?: any;
    content?: string;
    timestamp?: string;
}

export interface LogSearchParams {
    query: string;
    level?: string;
    startDate?: string;
    endDate?: string;
    logType?: 'application' | 'error';
    limit?: number;
}

export class LogService {
    private logDirectory: string;

    constructor() {
        this.logDirectory = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    /**
     * Ottiene informazioni dai file di audit
     */
    public getAuditInfo(): Record<string, LogAudit> {
        const auditFiles = fs.readdirSync(this.logDirectory)
            .filter(file => file.endsWith('-audit.json'));
        
        const auditData: Record<string, LogAudit> = {};
        
        auditFiles.forEach(auditFile => {
            try {
                const auditPath = path.join(this.logDirectory, auditFile);
                const content = fs.readFileSync(auditPath, 'utf8');
                const audit: LogAudit = JSON.parse(content);
                
                // Determina il tipo di log dall'hash del file di audit
                const logType = this.determineLogTypeFromAuditFile(auditFile);
                
                auditData[logType] = audit;
            } catch (error) {
                log.warn(`Errore nel leggere il file di audit ${auditFile}:`, { error });
            }
        });
        
        return auditData;
    }

    /**
     * Ottiene la cronologia completa dei log dai file di audit
     */
    public getLogHistory(): Record<string, LogFileInfo[]> {
        const auditFiles = fs.readdirSync(this.logDirectory)
            .filter(file => file.endsWith('-audit.json'));
        
        const history: Record<string, LogFileInfo[]> = {};
        
        auditFiles.forEach(auditFile => {
            try {
                const auditPath = path.join(this.logDirectory, auditFile);
                const content = fs.readFileSync(auditPath, 'utf8');
                const audit: LogAudit = JSON.parse(content);
                
                const logType = this.determineLogTypeFromAuditFile(auditFile);
                
                history[logType] = audit.files.map(file => {
                    const fileExists = fs.existsSync(file.name);
                    const stats = fileExists ? fs.statSync(file.name) : null;
                    
                    return {
                        name: path.basename(file.name),
                        size: stats ? stats.size : 0,
                        created: new Date(file.date),
                        modified: stats ? stats.mtime : new Date(file.date),
                        type: logType as 'application' | 'error' | 'other',
                        hash: file.hash,
                        fromAudit: true
                    };
                }).sort((a, b) => b.created.getTime() - a.created.getTime());
                
            } catch (error) {
                log.warn(`Errore nel processare il file di audit ${auditFile}:`, { error });
            }
        });
        
        return history;
    }

    /**
     * Cerca nei log in base ai parametri specificati
     */
    public searchLogs(params: LogSearchParams): {
        query: string;
        results: LogSearchResult[];
        totalFound: number;
        filesSearched: number;
    } {
        const { query, level, startDate, endDate, logType, limit = 100 } = params;
        
        const searchPattern = new RegExp(query, 'i');
        const results: LogSearchResult[] = [];
        
        // Determina quali file cercare
        let filesToSearch = this.getFilesToSearch(logType, startDate, endDate);
        
        // Cerca nei file
        filesToSearch.forEach(filename => {
            try {
                const filePath = path.join(this.logDirectory, filename);
                if (!fs.existsSync(filePath)) return;
                
                const content = fs.readFileSync(filePath, 'utf8');
                const isJsonLog = content.trim().startsWith('{');
                if (isJsonLog) {
                    const jsonResults = this.searchInJsonLog(content, filename, searchPattern, level);
                    results.push(...jsonResults);
                } else {
                    const textResults = this.searchInTextLog(content, filename, searchPattern, level);
                    results.push(...textResults);
                }
            } catch (error) {
                log.warn(`Errore nella ricerca nel file ${filename}:`, { error });
            }
        });
        
        // Ordina per timestamp e limita i risultati
        const sortedResults = results
            .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
            .slice(0, limit);
        
        return {
            query,
            results: sortedResults,
            totalFound: results.length,
            filesSearched: filesToSearch.length
        };
    }

    /**
     * Ottiene la lista dei file di log presenti nella directory
     */
    public getLogFiles(): LogFileInfo[] {
        return fs.readdirSync(this.logDirectory)
            .filter(file => file.endsWith('.log') && !file.startsWith('.'))
            .map(file => {
                const stats = fs.statSync(path.join(this.logDirectory, file));
                return {
                    name: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    type: file.startsWith('app-') ? 'application' : 
                          file.startsWith('error-') ? 'error' : 'other',
                    fromAudit: false
                };
            });
    }

    /**
     * Ottiene il contenuto di un file di log specifico
     */
    public getLogContent(filename: string, limit?: number): any {
        // Controllo di sicurezza per prevenire path traversal attack
        if (filename.includes('..') || !filename.endsWith('.log') || filename.startsWith('.')) {
            throw new BadRequestError({
                message: 'Nome file non valido',
                details: { filename },
            });
        }

        const filePath = path.join(this.logDirectory, filename);

        if (!fs.existsSync(filePath)) {
            throw new NotFoundError({
                message: 'File non trovato',
                entityType: 'LogFile',
                entityId: filename,
            });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        
        // Determina se è un log JSON (in produzione) o in formato testo
        const isJsonLog = content.trim().startsWith('{');
        
        if (isJsonLog) {
            // Parsing dei log in formato JSON
            let logEntries = content
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return { raw: line };
                    }
                });
            
            if (limit) {
                logEntries = logEntries.slice(-limit);
            }
            
            return { entries: logEntries };
        } else {
            // Gestisci log in formato testo
            const lines = content.split('\n');
            const lastLines = limit ? lines.slice(-limit) : lines;
            
            return { content: lastLines.join('\n') };
        }
    }

    /**
     * Svuota un file di log
     */
    public clearLog(filename: string, userId?: string): void {
        // Controllo di sicurezza per prevenire path traversal attack
        if (filename.includes('..') || !filename.endsWith('.log') || filename.startsWith('.')) {
            throw new BadRequestError({
                message: 'Nome file non valido',
                details: { filename },
            });
        }

        const filePath = path.join(this.logDirectory, filename);

        if (!fs.existsSync(filePath)) {
            throw new NotFoundError({
                message: 'File non trovato',
                entityType: 'LogFile',
                entityId: filename,
            });
        }

        // Svuota il file
        fs.writeFileSync(filePath, '');
        
        // Log dell'operazione
        log.info(`Log file ${filename} cleared by user ${userId || 'unknown'}`);
    }

    private determineLogTypeFromAuditFile(auditFile: string): string {
        if (auditFile.includes('447bbd')) return 'application';
        if (auditFile.includes('c1e951')) return 'error';
        return 'unknown';
    }

    private getFilesToSearch(logType?: string, startDate?: string, endDate?: string): string[] {
        let filesToSearch: string[] = [];
        
        if (logType === 'application' || !logType) {
            filesToSearch.push(...fs.readdirSync(this.logDirectory)
                .filter(file => file.startsWith('app-') && file.endsWith('.log')));
        }
        
        if (logType === 'error' || !logType) {
            filesToSearch.push(...fs.readdirSync(this.logDirectory)
                .filter(file => file.startsWith('error-') && file.endsWith('.log')));
        }
        
        // Filtra per data se specificato
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            filesToSearch = filesToSearch.filter(file => {
                const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
                if (!dateMatch) return false;
                
                const fileDate = new Date(dateMatch[1]);
                if (start && fileDate < start) return false;
                if (end && fileDate > end) return false;
                
                return true;
            });
        }
        
        return filesToSearch;
    }

    private searchInJsonLog(content: string, filename: string, searchPattern: RegExp, level?: string): LogSearchResult[] {
        const results: LogSearchResult[] = [];
        content.split('\n')
            .filter(line => line.trim() !== '')
            .forEach((line, lineNumber) => {
                try {
                    const entry = JSON.parse(line);
                    
                    // Filtra per livello se specificato
                    if (level && entry.level !== level) return;
                    
                    // Cerca nel messaggio e nei metadati
                    const searchableText = JSON.stringify(entry);
                    if (searchPattern.test(searchableText)) {
                        results.push({
                            file: filename,
                            line: lineNumber + 1,
                            entry: entry,
                            timestamp: entry.timestamp
                        });
                    }
                } catch (e) {
                    // Ignora errori di parsing
                }
            });
        return results;
    }

    private searchInTextLog(content: string, filename: string, searchPattern: RegExp, level?: string): LogSearchResult[] {
        const results: LogSearchResult[] = [];
        content.split('\n').forEach((line, lineNumber) => {
            if (searchPattern.test(line)) {
                // Filtra per livello se specificato
                if (level) {
                    const levelPattern = new RegExp(`\\b${level.toUpperCase()}\\b`, 'i');
                    if (!levelPattern.test(line)) return;
                }
                
                results.push({
                    file: filename,
                    line: lineNumber + 1,
                    content: line.trim(),
                    timestamp: this.extractTimestamp(line) ?? undefined
                });
            }
        });
        return results;
    }

    private extractTimestamp(line: string): string | null {
        const timestampMatch = line.match(/\[([^\]]+)\]/);
        return timestampMatch ? timestampMatch[1] : null;
    }
    public getPathForLog(filename: string): string {
        return path.join(this.logDirectory, filename);
    }
} 
