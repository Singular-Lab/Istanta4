import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type InkscapeRunner = (
  executable: string,
  args: string[],
  label?: string,
) => Promise<void>;

export type PdfToSvgParams = {
  pdfPath: string;
  outputPath: string;
  firstPage?: number;
  lastPage?: number;
  executableCandidates?: string[];
};

type ConvertPdfToSvgDeps = {
  platform?: NodeJS.Platform;
  existsSync?: (filePath: string) => boolean;
  mkdirSync?: (dirPath: string, options?: fs.MakeDirectoryOptions) => void;
  runInkscape?: InkscapeRunner;
  resolveWindowsExecutables?: () => string[];
};

export type PdfToSvgResult = {
  executable: string;
  outputPath: string;
  firstPage: number;
  lastPage: number;
};

function defaultRunInkscape(
  executable: string,
  args: string[],
  label = 'inkscape',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const errorChunks: Buffer[] = [];
    const proc = spawn(executable, args, {
      env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: '/dev/null' },
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    proc.on('error', (error) => reject(error));

    proc.on('close', (code) => {
      if (code !== 0) {
        const errorOutput = Buffer.concat(errorChunks).toString().trim();
        reject(new Error(`${label} exited with code ${code}. ${errorOutput}`));
        return;
      }
      resolve();
    });
  });
}

export function getWindowsInkscapeExecutables(
  existsSync: (filePath: string) => boolean = fs.existsSync,
): string[] {
  const resolvedExecutables: string[] = [];
  const seen = new Set<string>();

  const addExecutable = (executablePath: string, checkExists = true) => {
    if (checkExists && !existsSync(executablePath)) {
      return;
    }

    if (!seen.has(executablePath)) {
      seen.add(executablePath);
      resolvedExecutables.push(executablePath);
    }
  };

  const programRoots = [process.env.ProgramW6432, process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
    .filter((entry): entry is string => Boolean(entry));

  for (const root of programRoots) {
    addExecutable(path.join(root, 'Inkscape', 'bin', 'inkscape.exe'));
    addExecutable(path.join(root, 'inkscape', 'bin', 'inkscape.exe'));
  }

  // Fallback via PATH.
  addExecutable('inkscape.exe', false);
  addExecutable('inkscape', false);

  return resolvedExecutables;
}

export function buildPdfToSvgArgs(params: {
  pdfPath: string;
  outputPath: string;
  firstPage: number;
  lastPage: number;
  isWindows: boolean;
}): string[] {
  const normalizedPdfPath = params.isWindows
    ? params.pdfPath.replace(/\\/g, '/')
    : params.pdfPath;
  const normalizedOutputPath = params.isWindows
    ? params.outputPath.replace(/\\/g, '/')
    : params.outputPath;

  return [
    '--pdf-poppler',
    `--pages=${params.firstPage}`,
    '--export-type=svg',
    `--export-filename=${normalizedOutputPath}`,
    normalizedPdfPath,
  ];
}

function ensureValidPageRange(firstPage: number, lastPage: number): void {
  if (!Number.isInteger(firstPage) || !Number.isInteger(lastPage)) {
    throw new Error('firstPage e lastPage devono essere interi');
  }

  if (firstPage < 1 || lastPage < 1) {
    throw new Error('firstPage e lastPage devono essere >= 1');
  }

  if (lastPage < firstPage) {
    throw new Error('lastPage non puo essere minore di firstPage');
  }

  if (firstPage !== lastPage) {
    throw new Error('Con output SVG singolo firstPage e lastPage devono essere uguali');
  }
}

// Nome mantenuto per compatibilita col codice esistente, ma il backend e inkscape.
export async function convertPdfToSvgUsingPostScript(
  params: PdfToSvgParams,
  deps: ConvertPdfToSvgDeps = {},
): Promise<PdfToSvgResult> {
  const platform = deps.platform ?? process.platform;
  const existsSync = deps.existsSync ?? fs.existsSync;
  const mkdirSync = deps.mkdirSync ?? fs.mkdirSync;
  const runInkscape = deps.runInkscape ?? defaultRunInkscape;
  const isWindows = platform === 'win32';

  const firstPage = params.firstPage ?? 1;
  const lastPage = params.lastPage ?? firstPage;
  ensureValidPageRange(firstPage, lastPage);

  const pathForFs = isWindows
    ? params.pdfPath.replace(/\//g, '\\')
    : params.pdfPath;

  if (!existsSync(pathForFs)) {
    throw new Error(`File PDF non trovato: ${params.pdfPath}`);
  }

  const outputDir = path.dirname(params.outputPath);
  if (outputDir && outputDir !== '.' && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const executables = params.executableCandidates
    ?? (isWindows ? getWindowsInkscapeExecutables(existsSync) : ['inkscape']);

  let lastError: Error = new Error('inkscape non trovato');

  for (const executable of executables) {
    try {
      const args = buildPdfToSvgArgs({
        pdfPath: params.pdfPath,
        outputPath: params.outputPath,
        firstPage,
        lastPage,
        isWindows,
      });

      await runInkscape(executable, args, 'inkscape PDF->SVG');
      return {
        executable,
        outputPath: params.outputPath,
        firstPage,
        lastPage,
      };
    } catch (error) {
      lastError = error as Error;
      if (!isWindows) {
        throw lastError;
      }
    }
  }

  throw lastError;
}
