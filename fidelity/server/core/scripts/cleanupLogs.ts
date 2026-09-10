import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIGURAZIONE CLEANUP
// ============================================================================

interface CleanupConfig {
  logDirectory: string;
  maxAgeDays: {
    combined: number;
    error: number;
    http: number;
  };
  maxSizeMB: number; // Dimensione massima totale della directory log
  dryRun: boolean;   // Se true, stampa solo cosa verrebbe eliminato
}

const DEFAULT_CONFIG: CleanupConfig = {
  logDirectory: path.join(process.cwd(), 'logs'),
  maxAgeDays: {
    combined: 7,    // 7 giorni per log combinati
    error: 30,      // 30 giorni per errori
    http: 3         // 3 giorni per HTTP logs
  },
  maxSizeMB: 500,   // Max 500MB totali
  dryRun: false
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converte bytes in MB
 */
const bytesToMB = (bytes: number): number => {
  return bytes / (1024 * 1024);
};

/**
 * Formatta dimensione file
 */
const formatSize = (bytes: number): string => {
  const mb = bytesToMB(bytes);
  return mb < 1 ? `${(bytes / 1024).toFixed(2)} KB` : `${mb.toFixed(2)} MB`;
};

/**
 * Calcola età file in giorni
 */
const getFileAgeDays = (filePath: string): number => {
  const stats = fs.statSync(filePath);
  const now = Date.now();
  const fileTime = stats.mtime.getTime();
  return Math.floor((now - fileTime) / (1000 * 60 * 60 * 24));
};

/**
 * Determina tipo di log dal nome file
 */
const getLogType = (filename: string): 'combined' | 'error' | 'http' | 'unknown' => {
  if (filename.includes('combined')) return 'combined';
  if (filename.includes('error')) return 'error';
  if (filename.includes('http')) return 'http';
  return 'unknown';
};

/**
 * Verifica se un file è un log file
 */
const isLogFile = (filename: string): boolean => {
  return filename.endsWith('.log') || filename.endsWith('.log.gz');
};

// ============================================================================
// CLEANUP LOGIC
// ============================================================================

interface CleanupStats {
  totalFiles: number;
  deletedFiles: number;
  totalSize: number;
  freedSpace: number;
  errors: string[];
}

/**
 * Esegue cleanup dei log basato su età
 */
const cleanupByAge = (config: CleanupConfig, stats: CleanupStats): void => {
  const { logDirectory, maxAgeDays, dryRun } = config;

  if (!fs.existsSync(logDirectory)) {
    console.log(`📁 Directory log non trovata: ${logDirectory}`);
    return;
  }

  const files = fs.readdirSync(logDirectory);

  files.forEach(filename => {
    if (!isLogFile(filename)) return;

    const filePath = path.join(logDirectory, filename);
    const fileStats = fs.statSync(filePath);
    const ageDays = getFileAgeDays(filePath);
    const logType = getLogType(filename);
    const maxAge = maxAgeDays[logType] || 7;

    stats.totalFiles++;
    stats.totalSize += fileStats.size;

    if (ageDays > maxAge) {
      console.log(`  🗑️  ${filename} (${formatSize(fileStats.size)}, ${ageDays} giorni)`);

      if (!dryRun) {
        try {
          fs.unlinkSync(filePath);
          stats.deletedFiles++;
          stats.freedSpace += fileStats.size;
        } catch (error) {
          const errMsg = `Errore eliminando ${filename}: ${error}`;
          stats.errors.push(errMsg);
          console.error(`  ❌ ${errMsg}`);
        }
      } else {
        stats.deletedFiles++;
        stats.freedSpace += fileStats.size;
      }
    }
  });
};

/**
 * Esegue cleanup se dimensione totale supera il limite
 */
const cleanupBySize = (config: CleanupConfig, stats: CleanupStats): void => {
  const { logDirectory, maxSizeMB, dryRun } = config;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (stats.totalSize <= maxSizeBytes) {
    return;
  }

  console.log(`\n⚠️  Dimensione totale (${formatSize(stats.totalSize)}) supera il limite (${maxSizeMB} MB)`);
  console.log('📦 Eliminando file più vecchi...\n');

  const files = fs.readdirSync(logDirectory)
    .filter(isLogFile)
    .map(filename => {
      const filePath = path.join(logDirectory, filename);
      const fileStats = fs.statSync(filePath);
      return {
        filename,
        filePath,
        size: fileStats.size,
        mtime: fileStats.mtime.getTime()
      };
    })
    .sort((a, b) => a.mtime - b.mtime); // Più vecchi prima

  let currentSize = stats.totalSize - stats.freedSpace;

  for (const file of files) {
    if (currentSize <= maxSizeBytes) break;

    console.log(`  🗑️  ${file.filename} (${formatSize(file.size)})`);

    if (!dryRun) {
      try {
        fs.unlinkSync(file.filePath);
        stats.deletedFiles++;
        stats.freedSpace += file.size;
        currentSize -= file.size;
      } catch (error) {
        const errMsg = `Errore eliminando ${file.filename}: ${error}`;
        stats.errors.push(errMsg);
        console.error(`  ❌ ${errMsg}`);
      }
    } else {
      stats.deletedFiles++;
      stats.freedSpace += file.size;
      currentSize -= file.size;
    }
  }
};

/**
 * Stampa statistiche cleanup
 */
const printStats = (stats: CleanupStats, dryRun: boolean): void => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 STATISTICHE CLEANUP');
  console.log('='.repeat(60));
  console.log(`File totali:           ${stats.totalFiles}`);
  console.log(`File ${dryRun ? 'da eliminare' : 'eliminati'}:      ${stats.deletedFiles}`);
  console.log(`Dimensione totale:     ${formatSize(stats.totalSize)}`);
  console.log(`Spazio ${dryRun ? 'liberabile' : 'liberato'}:       ${formatSize(stats.freedSpace)}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errori: ${stats.errors.length}`);
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }

  if (dryRun) {
    console.log('\n⚠️  MODALITÀ DRY-RUN: Nessun file è stato eliminato');
    console.log('   Esegui senza --dry-run per eliminare effettivamente i file');
  }

  console.log('='.repeat(60) + '\n');
};

// ============================================================================
// MAIN CLEANUP FUNCTION
// ============================================================================

/**
 * Esegue cleanup completo dei log
 */
export const cleanupLogs = (customConfig?: Partial<CleanupConfig>): CleanupStats => {
  const config: CleanupConfig = { ...DEFAULT_CONFIG, ...customConfig };

  const stats: CleanupStats = {
    totalFiles: 0,
    deletedFiles: 0,
    totalSize: 0,
    freedSpace: 0,
    errors: []
  };

  console.log('\n' + '='.repeat(60));
  console.log('🧹 CLEANUP LOG FILES');
  console.log('='.repeat(60));
  console.log(`Directory:             ${config.logDirectory}`);
  console.log(`Max età combined:      ${config.maxAgeDays.combined} giorni`);
  console.log(`Max età error:         ${config.maxAgeDays.error} giorni`);
  console.log(`Max età http:          ${config.maxAgeDays.http} giorni`);
  console.log(`Max dimensione totale: ${config.maxSizeMB} MB`);
  console.log(`Modalità:              ${config.dryRun ? 'DRY-RUN' : 'ELIMINA'}`);
  console.log('='.repeat(60) + '\n');

  // Cleanup per età
  console.log('🗓️  Cleanup per età file...\n');
  cleanupByAge(config, stats);

  // Cleanup per dimensione totale
  cleanupBySize(config, stats);

  // Statistiche finali
  printStats(stats, config.dryRun);

  return stats;
};

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  // Parsing argomenti custom
  const customConfig: Partial<CleanupConfig> = {
    dryRun
  };

  // Override retention se specificato
  const combinedDaysArg = args.find(arg => arg.startsWith('--combined-days='));
  const errorDaysArg = args.find(arg => arg.startsWith('--error-days='));
  const httpDaysArg = args.find(arg => arg.startsWith('--http-days='));
  const maxSizeArg = args.find(arg => arg.startsWith('--max-size='));

  if (combinedDaysArg || errorDaysArg || httpDaysArg) {
    customConfig.maxAgeDays = {
      combined: combinedDaysArg ? parseInt(combinedDaysArg.split('=')[1]) : DEFAULT_CONFIG.maxAgeDays.combined,
      error: errorDaysArg ? parseInt(errorDaysArg.split('=')[1]) : DEFAULT_CONFIG.maxAgeDays.error,
      http: httpDaysArg ? parseInt(httpDaysArg.split('=')[1]) : DEFAULT_CONFIG.maxAgeDays.http
    };
  }

  if (maxSizeArg) {
    customConfig.maxSizeMB = parseInt(maxSizeArg.split('=')[1]);
  }

  // Esegui cleanup
  cleanupLogs(customConfig);
}
