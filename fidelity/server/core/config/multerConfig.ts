import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

/**
 * Centralized Multer configuration for file uploads.
 * All upload configurations should be imported from this file.
 */

// ============================================
// DIRECTORY PATHS
// ============================================

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads');
const TMP_DIR = path.join(UPLOAD_BASE_DIR, 'tmp');
const MATERIALI_POP_DIR = path.join(process.cwd(), 'public', 'uploads', 'materiali_POP');

// Ensure directories exist
[TMP_DIR, MATERIALI_POP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// FILE SIZE LIMITS (in bytes)
// ============================================

export const FILE_SIZE_LIMITS = {
  SMALL: 200 * 1024,           // 200 KB - for icons, small images
  MEDIUM: 10 * 1024 * 1024,    // 10 MB - for spreadsheets, documents
  LARGE: 100 * 1024 * 1024,    // 100 MB - for ZIP files, large uploads
  EXTRA_LARGE: 200 * 1024 * 1024, // 200 MB - for tracciati, materiali
  HUGE: 500 * 1024 * 1024,     // 500 MB - for dashboard imports
} as const;

// ============================================
// MIME TYPES
// ============================================

export const ALLOWED_MIME_TYPES = {
  SVG: ['image/svg+xml'],
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  VIDEOS: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  SPREADSHEETS: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/csv'
  ],
  ZIP: ['application/zip', 'application/x-zip-compressed'],
  PDF: ['application/pdf'],
  ALL_DOCUMENTS: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
} as const;

// ============================================
// FILE FILTERS
// ============================================

type FileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void;

/**
 * Creates a file filter that only accepts specific MIME types
 */
export const createMimeFilter = (allowedMimes: readonly string[], errorMessage?: string): FileFilter => {
  return (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(errorMessage || `Formato file non supportato. Tipi accettati: ${allowedMimes.join(', ')}`));
    }
  };
};

/**
 * Creates a file filter that only accepts specific file extensions
 */
export const createExtensionFilter = (allowedExtensions: string[], errorMessage?: string): FileFilter => {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(errorMessage || `Estensione file non supportata. Estensioni accettate: ${allowedExtensions.join(', ')}`));
    }
  };
};

// Pre-built file filters
export const fileFilters = {
  svg: createMimeFilter(ALLOWED_MIME_TYPES.SVG, 'Formato file non valido. Solo SVG accettato.'),
  images: createMimeFilter(ALLOWED_MIME_TYPES.IMAGES, 'Formato immagine non valido.'),
  videos: createMimeFilter(ALLOWED_MIME_TYPES.VIDEOS, 'Formato video non supportato. Usa MP4, WebM, OGG o MOV.'),
  spreadsheets: createMimeFilter(ALLOWED_MIME_TYPES.SPREADSHEETS, 'Formato file non supportato. Usa .xlsx, .xls o .csv'),
  zip: createExtensionFilter(['.zip'], 'Sono accettati solo file .zip'),
  pdf: createMimeFilter(ALLOWED_MIME_TYPES.PDF, 'Formato file non valido. Solo PDF accettato.'),
};

// ============================================
// STORAGE CONFIGURATIONS
// ============================================

/**
 * Memory storage - files stored in memory as Buffer
 * Use for small files or when you need to process before saving
 */
export const memoryStorage = multer.memoryStorage();

/**
 * Creates disk storage with custom destination and filename
 */
export const createDiskStorage = (
  destinationDir: string,
  filenameGenerator?: (req: Request, file: Express.Multer.File) => string
): StorageEngine => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }
      cb(null, destinationDir);
    },
    filename: (req, file, cb) => {
      const filename = filenameGenerator
        ? filenameGenerator(req, file)
        : `${Date.now()}-${file.originalname}`;
      cb(null, filename);
    }
  });
};

// Pre-built storage configurations
export const storageConfigs = {
  tmp: createDiskStorage(TMP_DIR),
  tmpWithTimestamp: createDiskStorage(TMP_DIR, (req, file) => `${Date.now()}-${file.originalname}`),
  materialiPOP: createDiskStorage(MATERIALI_POP_DIR, (req, file) => file.originalname),
};

// ============================================
// MULTER INSTANCES
// ============================================

/**
 * Upload configuration for SVG icons (GDO icons)
 * - Memory storage
 * - 200 KB limit
 * - SVG only
 */
export const uploadSvgIcon = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.SMALL },
  fileFilter: fileFilters.svg
});

/**
 * Upload configuration for spreadsheets (Excel/CSV imports)
 * - Memory storage
 * - 10 MB limit
 * - xlsx, xls, csv only
 */
export const uploadSpreadsheet = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.MEDIUM },
  fileFilter: fileFilters.spreadsheets
});

/**
 * Upload configuration for ZIP files (dashboard imports)
 * - Disk storage (tmp directory)
 * - 500 MB limit
 * - .zip only
 */
export const uploadZip = multer({
  storage: storageConfigs.tmpWithTimestamp,
  limits: { fileSize: FILE_SIZE_LIMITS.HUGE },
  fileFilter: fileFilters.zip
});

/**
 * Upload configuration for in-memory ZIP processing
 * - Memory storage
 * - 100 MB limit
 */
export const uploadZipMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.LARGE }
});

/**
 * Upload configuration for tracciati files
 * - Memory storage
 * - 200 MB file limit, 10 MB field limit
 */
export const uploadTracciati = multer({
  storage: memoryStorage,
  limits: {
    fileSize: FILE_SIZE_LIMITS.EXTRA_LARGE,
    fieldSize: FILE_SIZE_LIMITS.MEDIUM
  }
});

/**
 * Upload configuration for materiali pubblicazioni
 * - Disk storage (materiali_POP directory)
 * - 200 MB field limit
 */
export const uploadMaterialiPubblicazioni = multer({
  storage: storageConfigs.materialiPOP,
  limits: { fieldSize: FILE_SIZE_LIMITS.EXTRA_LARGE }
});

/**
 * Upload configuration for forced Olimpo images
 * - Memory storage
 * - 200 MB limit
 */
export const uploadOlimpoImages = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.EXTRA_LARGE }
});

/**
 * Upload configuration for Hub Service shared documents
 * - Memory storage
 * - 10 MB limit
 * - PDF and office docs
 */
export const uploadHubServiceDocuments = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.MEDIUM },
  fileFilter: createMimeFilter(
    ALLOWED_MIME_TYPES.ALL_DOCUMENTS,
    'Formato documentazione non supportato. Usa PDF, Word, Excel o CSV.'
  )
});

/**
 * Upload configuration for Hub Service shared videos
 * - Memory storage
 * - 200 MB limit
 * - Common video formats
 */
export const uploadHubServiceVideos = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.EXTRA_LARGE },
  fileFilter: fileFilters.videos
});

/**
 * Generic upload configuration with custom options
 */
export const createUpload = (options: {
  storage?: StorageEngine;
  fileSize?: number;
  fieldSize?: number;
  fileFilter?: FileFilter;
  fields?: number;
  files?: number;
  parts?: number;
}) => {
  return multer({
    storage: options.storage || memoryStorage,
    limits: {
      fileSize: options.fileSize,
      fieldSize: options.fieldSize,
      fields: options.fields,
      files: options.files,
      parts: options.parts
    },
    fileFilter: options.fileFilter
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Ensures a directory exists, creating it if necessary
 */
export const ensureUploadDir = (dirPath: string): string => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

/**
 * Cleans up temporary files older than specified age
 */
export const cleanupTmpFiles = async (maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> => {
  let deletedCount = 0;
  const now = Date.now();

  try {
    const files = fs.readdirSync(TMP_DIR);
    for (const file of files) {
      const filePath = path.join(TMP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
  } catch (error) {
    console.error('Error cleaning up tmp files:', error);
  }

  return deletedCount;
};

export default {
  // Instances
  uploadSvgIcon,
  uploadSpreadsheet,
  uploadZip,
  uploadZipMemory,
  uploadTracciati,
  uploadMaterialiPubblicazioni,
  uploadOlimpoImages,
  uploadHubServiceDocuments,
  uploadHubServiceVideos,
  // Factories
  createUpload,
  createDiskStorage,
  createMimeFilter,
  createExtensionFilter,
  // Constants
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
  fileFilters,
  storageConfigs,
  memoryStorage,
  // Utilities
  ensureUploadDir,
  cleanupTmpFiles
};
