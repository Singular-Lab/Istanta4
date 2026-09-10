import { Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { authMiddleware } from '../middleware/authMiddleware';
import { BaseController } from '../base/BaseController';
import { LogService, LogSearchParams } from '../services/LogService';
import fs from 'fs';
import { userRoleGuard } from '../middleware/userRoleGuard';

export class LogController extends BaseController {
    private logService: LogService;

    constructor() {
        super('/api/log');
        this.logService = new LogService();
    }

    protected setupRoutes(): void {
        const guard = [authMiddleware, userRoleGuard([TIPO_UTENTI.SUPERADMIN])];

        this.router.get(`/list`, ...guard, this.getLogFiles.bind(this));
        this.router.get(`/audit`, ...guard, this.getAuditInfo.bind(this));
        this.router.get(`/history`, ...guard, this.getLogHistory.bind(this));
        this.router.get(`/view/:filename`, ...guard, this.getLogContent.bind(this));
        this.router.get(`/stats`, ...guard, this.getApiStats.bind(this));
        this.router.get(`/search`, ...guard, this.searchLogs.bind(this));
        this.router.delete(`/clear/:filename`, ...guard, this.clearLog.bind(this));
        this.router.get(`/latest`, ...guard, this.getLatestLog.bind(this));

    }

    // Nuovo metodo per ottenere informazioni dai file di audit
    private getAuditInfo(req: Request, res: Response) {
        try {
            const auditData = this.logService.getAuditInfo();
            res.json({ audits: auditData });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    // Nuovo metodo per ottenere la cronologia completa dei log
    private getLogHistory(req: Request, res: Response) {
        try {
            const history = this.logService.getLogHistory();
            res.json({ history });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    // Nuovo metodo per la ricerca nei log
    private searchLogs(req: Request, res: Response) {
        try {
            const { query, level, startDate, endDate, logType, limit = 100 } = req.query;

            if (!query) {
                return res.status(400).json({ error: 'Query di ricerca richiesta' });
            }

            const searchParams: LogSearchParams = {
                query: query as string,
                level: level as string,
                startDate: startDate as string,
                endDate: endDate as string,
                logType: logType as 'application' | 'error',
                limit: parseInt(limit as string)
            };

            const searchResult = this.logService.searchLogs(searchParams);
            res.json(searchResult);

        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private getLogFiles(req: Request, res: Response) {
        try {
            const files = this.logService.getLogFiles();
            res.json({ files });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private getLogContent(req: Request, res: Response) {
        try {
            const filename = req.params.filename;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

            const content = this.logService.getLogContent(filename, limit);
            res.json(content);
        } catch (error: any) {
            if (error.message === 'Nome file non valido') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'File non trovato') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }

    private getApiStats(req: Request, res: Response) {
        try {
            // Utilizza il servizio per ottenere i file di log
            const allFiles = this.logService.getLogFiles();
            const logFiles = allFiles
                .filter(file => file.type === 'application')
                .map(file => file.name);

            if (logFiles.length === 0) {
                return res.status(404).json({ error: 'File di log non trovati' });
            }

            // Analizza il file di log più recente
            const latestLogFile = logFiles.sort().reverse()[0];
            const logContent = this.logService.getLogContent(latestLogFile);
            const content = logContent.content || JSON.stringify(logContent.entries || []);

            // Determina se è un log JSON o in formato testo
            const isJsonLog = content.trim().startsWith('{');

            let endpoints: Record<string, number> = {};
            let methodCounts: Record<string, number> = {};
            let statusCodes: Record<string, number> = {};
            let httpRequests = 0;

            if (isJsonLog) {
                // Parsing dei log JSON
                const logEntries = content
                    .split('\n')
                    .filter((line: string) => line.trim() !== '')
                    .map((line: string) => {
                        try {
                            return JSON.parse(line);
                        } catch (e) {
                            return null;
                        }
                    })
                    .filter((entry: { level: string; } | null) => entry !== null && entry.level === 'http');

                httpRequests = logEntries.length;

                logEntries.forEach((entry: { method: any; url: any; status: { toString: () => any; }; }) => {
                    if (entry.method && entry.url && entry.status) {
                        const method = entry.method;
                        const url = entry.url;
                        const statusCode = entry.status.toString();

                        // Estrai solo la parte dell'endpoint senza query params
                        const endpoint = url.split('?')[0];

                        endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
                        methodCounts[method] = (methodCounts[method] || 0) + 1;
                        statusCodes[statusCode] = (statusCodes[statusCode] || 0) + 1;
                    }
                });
            } else {
                // Parsing dei log in formato testo per le righe HTTP
                const lines = content
                    .split('\n')
                    .filter((line: string | string[]) => line.includes('HTTP:'));

                httpRequests = lines.length;

                lines.forEach((line: string) => {
                    try {
                        // Estrai metodo, URL e status dal messaggio di log
                        const methodMatch = line.match(/method: (\w+)/);
                        const urlMatch = line.match(/url: ([^ ,]+)/);
                        const statusMatch = line.match(/status: (\d{3})/);

                        if (methodMatch && urlMatch && statusMatch) {
                            const method = methodMatch[1];
                            const url = urlMatch[1];
                            const statusCode = statusMatch[1];

                            // Estrai solo la parte dell'endpoint senza query params
                            const endpoint = url.split('?')[0];

                            endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
                            methodCounts[method] = (methodCounts[method] || 0) + 1;
                            statusCodes[statusCode] = (statusCodes[statusCode] || 0) + 1;
                        }
                    } catch (e) {
                        // Ignora errori di parsing
                    }
                });
            }

            // Ottieni le richieste più frequenti
            const topEndpoints = Object.entries(endpoints)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([endpoint, count]) => ({ endpoint, count }));

            res.json({
                totalRequests: httpRequests,
                methodCounts,
                statusCodes,
                topEndpoints
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    private clearLog(req: Request, res: Response) {
        try {
            const filename = req.params.filename;
            const userId = req.session?.id_utente;

            this.logService.clearLog(filename, userId);

            res.json({ success: true, message: `File ${filename} svuotato` });
        } catch (error: any) {
            if (error.message === 'Nome file non valido') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'File non trovato') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }

        private getLatestLog(req: Request, res: Response) {
        try {
            const allFiles = this.logService.getLogFiles()
                .map(f => f.name)
                .sort()
                .reverse();

            if (allFiles.length === 0) {
                return res.status(404)
                    .send(`<html><body><h2>Nessun file di log trovato</h2></body></html>`);
            }

            const latest = allFiles[0];
            const logContent = this.logService.getLogContent(latest);
            const content = logContent.content || JSON.stringify(logContent.entries || []);
            // Funzione per convertire i colori ANSI in HTML
            const convertAnsiToHtml = (text: string): string => {
                // Escape HTML prima di processare i colori
                let escaped = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");

                // Regex per i codici ANSI
                const ansiRegex = /\x1b\[(\d+(?:;\d+)*)?m/g;
                let result = '';
                let lastIndex = 0;
                let match;

                while ((match = ansiRegex.exec(escaped)) !== null) {
                    // Aggiungi il testo prima del codice ANSI
                    result += escaped.slice(lastIndex, match.index);

                    const codes = match[1] ? match[1].split(';').map(Number) : [0];
                    let colorClass = '';

                    // Processa i codici ANSI
                    for (const code of codes) {
                        switch (code) {
                            case 0: // Reset
                                colorClass = '';
                                break;
                            case 30: // Black
                                colorClass = 'text-gray-900';
                                break;
                            case 31: // Red
                                colorClass = 'text-red-600';
                                break;
                            case 32: // Green
                                colorClass = 'text-green-600';
                                break;
                            case 33: // Yellow
                                colorClass = 'text-yellow-600';
                                break;
                            case 34: // Blue
                                colorClass = 'text-blue-600';
                                break;
                            case 35: // Magenta
                                colorClass = 'text-purple-600';
                                break;
                            case 36: // Cyan
                                colorClass = 'text-cyan-600';
                                break;
                            case 37: // White
                                colorClass = 'text-gray-100';
                                break;
                            case 90: // Bright Black (Gray)
                                colorClass = 'text-gray-600';
                                break;
                            case 91: // Bright Red
                                colorClass = 'text-red-500';
                                break;
                            case 92: // Bright Green
                                colorClass = 'text-green-500';
                                break;
                            case 93: // Bright Yellow
                                colorClass = 'text-yellow-500';
                                break;
                            case 94: // Bright Blue
                                colorClass = 'text-blue-500';
                                break;
                            case 95: // Bright Magenta
                                colorClass = 'text-purple-500';
                                break;
                            case 96: // Bright Cyan
                                colorClass = 'text-cyan-500';
                                break;
                            case 97: // Bright White
                                colorClass = 'text-white';
                                break;
                            case 1: // Bold
                                colorClass += ' font-bold';
                                break;
                        }
                    }

                    // Trova il prossimo reset o fine stringa
                    const nextReset = escaped.indexOf('\x1b[0m', match.index);
                    const nextAnsi = escaped.indexOf('\x1b[', match.index + match[0].length);
                    const endIndex = nextReset !== -1 && (nextAnsi === -1 || nextReset < nextAnsi)
                        ? nextReset
                        : nextAnsi !== -1 ? nextAnsi : escaped.length;

                    // Estrai il testo colorato
                    const coloredText = escaped.slice(match.index + match[0].length, endIndex);

                    if (colorClass) {
                        result += `<span class="${colorClass}">${coloredText}</span>`;
                    } else {
                        result += coloredText;
                    }

                    lastIndex = endIndex;
                    if (nextReset !== -1 && nextReset < endIndex) {
                        lastIndex += 4; // Salta il \x1b[0m
                    }
                }

                // Aggiungi il resto del testo
                result += escaped.slice(lastIndex);

                return result;
            };

            // Mostra il contenuto puro del log con colori formattati
            const lines = content.split('\n').filter((line: string) => line.trim() !== '');
            const lastLines = lines.slice(-500); // Mostra gli ultimi 500 log
            const formattedContent = lastLines.map((line: string) => convertAnsiToHtml(line)).join('\n');



            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(`
                <!DOCTYPE html>
                <html lang="it" class="theme-1">
                    <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                                 <title>Visualizzatore Log: ${latest.replace(/[<>&"']/g, '')}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23309'%2F%3E%3Ctext x='16' y='21' font-size='15' text-anchor='middle' fill='white' font-family='monospace,Arial,sans-serif'%3ELOG%3C%2Ftext%3E%3C%2Fsvg%3E">
                        <script>
                            tailwind.config = {
                                theme: {
                                    extend: {
                                        colors: {
                                            primary: "rgb(var(--color-primary) / <alpha-value>)",
                                            secondary: "rgb(var(--color-secondary) / <alpha-value>)",
                                            success: "rgb(var(--color-success) / <alpha-value>)",
                                            info: "rgb(var(--color-info) / <alpha-value>)",
                                            warning: "rgb(var(--color-warning) / <alpha-value>)",
                                            danger: "rgb(var(--color-danger) / <alpha-value>)",
                                            light: "rgb(var(--color-light) / <alpha-value>)",
                                            dark: "rgb(var(--color-dark) / <alpha-value>)",
                                        }
                                    }
                                }
                            }
                        </script>
                        <style>
                            :root {
                                --color-primary: 48 9 119;
                                --color-secondary: 226 232 240;
                                --color-success: 13 148 136;
                                --color-info: 8 145 178;
                                --color-warning: 202 138 4;
                                --color-danger: 185 28 28;
                                --color-light: 241 245 249;
                                --color-dark: 30 41 59;
                            }
                            .dark {
                                --color-primary: 30 58 138;
                            }
                            .scrollbar {
                                scrollbar-width: thin;
                                scrollbar-color: rgb(100 116 139) transparent;
                            }
                            .scrollbar::-webkit-scrollbar {
                                width: 6px;
                                height: 6px;
                            }
                            .scrollbar::-webkit-scrollbar-track {
                                background: transparent;
                            }
                            .scrollbar::-webkit-scrollbar-thumb {
                                background-color: rgb(100 116 139);
                                border-radius: 3px;
                            }
                            .scrollbar::-webkit-scrollbar-button {
                                display: none;
                            }
                            .scrollbar::-webkit-scrollbar-corner {
                                background: transparent;
                            }
                            .log-entry {
                                animation: fadeInUp 0.3s ease-out;
                            }
                            @keyframes fadeInUp {
                                from {
                                    opacity: 0;
                                    transform: translateY(10px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }
                        </style>
                    </head>
                    <body class="bg-light min-h-screen font-['DM_Sans'] text-dark">
                        <div class="container mx-auto px-4 py-6 max-w-full">
                            <!-- Header -->
                            <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                                                                         <h1 class="text-3xl font-bold text-dark">Visualizzatore Log</h1>
                                             <p class="text-gray-600">Ultimi 500 log dal file più recente</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm text-gray-500 mb-1">File di log:</div>
                                                                                 <div class="font-mono text-primary font-semibold text-lg">${latest.replace(/[<>&"']/g, '')}</div>
                                        <div class="text-xs text-gray-400 mt-1">Aggiornato: ${new Date().toLocaleString('it-IT')}</div>
                                    </div>
                                </div>
                            </div>



                            <!-- Log Content -->
                            <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                    <div class="flex items-center justify-between">
                                                                                 <h2 class="text-xl font-semibold text-dark">Ultimi 500 Log</h2>
                                        <div class="flex items-center space-x-2">
                                            <button onclick="refreshLogs()" class="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
                                                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                                </svg>
                                                Aggiorna
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="scrollbar max-h-screen overflow-y-auto p-4" id="log-container">
                                                                         <pre class="text-sm text-gray-800 font-mono leading-relaxed whitespace-pre-wrap break-all">${formattedContent}</pre>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div class="mt-6 text-center text-sm text-gray-500">
                                <p>Visualizzatore log statico • Aggiornamento manuale</p>
                            </div>
                        </div>

                                                 <script>
                             // Funzione per aggiornare i log
                             function refreshLogs() {
                                 location.reload();
                             }

                             // Scroll automatico in fondo alla lista dei log
                             document.addEventListener('DOMContentLoaded', function() {
                                 const container = document.getElementById('log-container');
                                 container.scrollTop = container.scrollHeight;
                             });

                             // Auto-refresh ogni 30 secondi
                             setInterval(refreshLogs, 30000);
                         </script>
                    </body>
                </html>
            `);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

}
