import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import { MultipartFile } from '@fastify/multipart';
import { Colorize } from '@lib/colorize';
import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Post,
    Query,
    Req,
    Res
} from '@nestjs/common';
import { FileItemKit, JSONMetaFileMateriale } from '@server_types/types';
import { exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as mime from 'mime-types';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import { AbsolutePaths } from 'src/models/absolute_path.model';
import { Materiali } from 'src/models/materiali.model';
import { VideoAttributes } from 'src/models/video.model';
import { WebsocketGateway } from 'src/websocket/websocket.getaway';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { OlimpoService } from '../app.service';
import { MaterialiService } from './materiali.service';
import { convertPdfToSvgUsingPostScript } from './pdf-to-svg.postscript';
import AdmZip = require('adm-zip');

const execAsync = promisify(exec);

type GroupPDFsByEqualityResult = {
    esito: boolean;
    groups?: Array<{ groupId?: string; ids: string[] }>;
    unmatchedIds?: string[];
    nonPdfIds?: string[];
    error?: string;
};

@Controller('materiali')
export class MaterialiController {

    private PATH_WEB_ASSOLUTO: AbsolutePaths;
    private PATH_ARCHIVIO_ASSOLUTO: AbsolutePaths;
    private PATH_VIDEO_ASSOLUTO: AbsolutePaths;
    private PATH_MATERIALI_ASSOLUTO: AbsolutePaths;
    constructor(private readonly olimpoService: OlimpoService, private readonly materialiService: MaterialiService, private readonly websocketGateway: WebsocketGateway) {
        this.init();
    }
    async init() {
        this.PATH_WEB_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
        this.PATH_ARCHIVIO_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);
        this.PATH_VIDEO_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.VIDEO);
        this.PATH_MATERIALI_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
    }

    private async groupPDFsByEquality(ids: string[], socketId?: string): Promise<GroupPDFsByEqualityResult> {
        const emitWs = (eventSuffix: string, data: any) => {
            if (socketId) {
                this.websocketGateway.server.emit(`${socketId}_${eventSuffix}`, data);
            }
        };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { esito: false, error: 'Invalid ids array' };
        }

        const materials = await this.materialiService.getAllMaterliFromIds(ids);
        if (!materials || materials.length === 0) {
            return { esito: false, error: 'No materials found for provided ids' };
        }

        const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
        if (!pathMateriale?.path) {
            return { esito: false, error: 'Invalid materials path' };
        }
        const pdfMaterials = materials.filter(m => path.extname(m.file_name).toLowerCase() === '.pdf');

        emitWs('info', {
            totalIds: ids.length,
            totalMaterials: materials.length,
            totalPdfs: pdfMaterials.length,
            message: `Trovati ${materials.length} materiali su ${ids.length} IDs forniti (${pdfMaterials.length} PDF)`
        });

        const hashMap: Record<string, Materiali[]> = {};
        pdfMaterials.forEach(material => {
            if (!hashMap[material.md5]) {
                hashMap[material.md5] = [];
            }
            hashMap[material.md5].push(material);
        });

        const groupedMaterials: Materiali[][] = Object.values(hashMap).filter(group => group.length > 1);



        const assigned = new Set<string>();
        const thumbnailHashCache = new Map<string, string | null>();
        const thumbDir = path.join(pathMateriale.path, 'thumbnails');
        const PHASH_HAMMING_THRESHOLD = [1, 5];
        const n = Object.keys(hashMap).length;
        const totalPairs = (n * (n - 1)) / 2;
        let completedPairs = 0;
        emitWs('progress', {
            phase: 'md5_grouping',
            totalPdfs: pdfMaterials.length,
            md5Groups: groupedMaterials.length,
            uniqueMd5Materials: n,
            totalPairs,
            percentage: 0,
            message: `<div class="flex w-full items-center gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
    <span class="font-semibold text-slate-800">Raggruppamento MD5</span>
    <span>Gruppi: <strong>${groupedMaterials.length}</strong></span>
    <span>PDF unici: <strong>${n}</strong></span>
    <span>Coppie: <strong>${totalPairs}</strong></span>
    <div class="ml-auto h-1.5 w-32 rounded bg-slate-200">
      <div class="h-1.5 rounded bg-slate-600" style="width: 0%"></div>
    </div>
    <span class="w-10 text-right">0%</span>
  </div>`
        });


        for (let i = 0; i < n; i++) {
            const current = Object.values(hashMap)[i][0];
            if (assigned.has(current.id)) {
                completedPairs += (n - i - 1);
                continue;
            }

            const pathA = path.join(pathMateriale.path, current.file_name);
            if (!fs.existsSync(pathA)) {
                completedPairs += (n - i - 1);
                continue;
            }

            const group = [current];
            for (let j = i + 1; j < n; j++) {
                completedPairs++;
                const percentage = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 100;

                const candidate = Object.values(hashMap)[j][0];
                if (assigned.has(candidate.id)) {
                    continue;
                }

                const pathB = path.join(pathMateriale.path, candidate.file_name);
                if (!fs.existsSync(pathB)) {
                    continue;
                }

                emitWs('progress', {
                    phase: 'pair_comparison',
                    current: completedPairs,
                    total: totalPairs,
                    percentage,
                    fileA: current.original_name,
                    fileB: candidate.original_name,
                    message: `<div class="flex w-full items-center gap-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
    <span class="font-semibold text-indigo-800">Confronto PDF</span>
    <span>${completedPairs}/${totalPairs}</span>
    <span class="font-medium">${percentage}%</span>
    <span class="truncate max-w-xs">
      <strong>A:</strong> ${current.original_name}
    </span>
    <span class="truncate max-w-xs">
      <strong>B:</strong> ${candidate.original_name}
    </span>
    <div class="ml-auto h-1.5 w-32 rounded bg-indigo-200">
      <div class="h-1.5 rounded bg-indigo-600" style="width: ${percentage}%"></div>
    </div>
  </div>`
                });

                try {
                    let areEqual = false;

                    const keyA = current.id;
                    const keyB = candidate.id;

                    if (!thumbnailHashCache.has(keyA)) {
                        thumbnailHashCache.set(
                            keyA,
                            await hashPdfThumbnails(keyA, thumbDir, Number(current.pagine))
                        );
                    }

                    if (!thumbnailHashCache.has(keyB)) {
                        thumbnailHashCache.set(
                            keyB,
                            await hashPdfThumbnails(keyB, thumbDir, Number(candidate.pagine))
                        );
                    }

                    const hashA = thumbnailHashCache.get(keyA);
                    const hashB = thumbnailHashCache.get(keyB);

                    if (hashA && hashB && hashA.length === hashB.length) {
                        const distance = hammingDistanceHex(hashA, hashB);
                        if (distance < PHASH_HAMMING_THRESHOLD[0]) {
                            areEqual = true;
                        } else if (distance > PHASH_HAMMING_THRESHOLD[1]) {
                            areEqual = false;
                        } else {
                            areEqual = await comparePdfDeepAsync(pathA, pathB);
                        }
                    } else {
                        areEqual = await comparePdfDeepAsync(pathA, pathB);
                    }

                    if (areEqual) {
                        group.push(candidate);
                        assigned.add(candidate.id);
                    }
                } catch (compareError) {
                    console.error(Colorize.bgRed(`[groupPDFsByEquality] Errore confronto profondo: ${compareError.message}`));
                    emitWs('error', {
                        current: completedPairs,
                        total: totalPairs,
                        percentage,
                        fileA: current.original_name,
                        fileB: candidate.original_name,
                        error: compareError.message,
                        message: `<div class="flex w-full items-center gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
    <span class="font-semibold text-red-800">Errore confronto</span>
    <span>${completedPairs}/${totalPairs}</span>
    <span class="font-medium">${percentage}%</span>
    <span class="truncate max-w-xs">
      <strong>A:</strong> ${current.original_name}
    </span>
    <span class="truncate max-w-xs">
      <strong>B:</strong> ${candidate.original_name}
    </span>
    <span class="ml-auto truncate max-w-sm font-semibold text-red-800">
      ${compareError.message}
    </span>
  </div>`
                    });

                }
            }

            assigned.add(current.id);
            if (group.length > 1) {
                groupedMaterials.push(group);
            }
        }

        const groups = groupedMaterials.map((group, index) => ({
            groupId: `group-${index + 1}`,
            ids: group.map(material => material.id),
        }));

        const pdfIdSet = new Set(pdfMaterials.map(m => m.id));
        const materialIdSet = new Set(materials.map(m => m.id));
        const matchedIds = new Set(groups.flatMap(group => group.ids));
        const nonPdfIds = ids.filter(id => materialIdSet.has(id) && !pdfIdSet.has(id));
        const nonPdfIdSet = new Set(nonPdfIds);
        const unmatchedIds = ids.filter(id => !matchedIds.has(id) && !nonPdfIdSet.has(id));

        emitWs('complete', {
            totalGroups: groups.length,
            unmatchedCount: unmatchedIds.length,
            nonPdfCount: nonPdfIds.length,
            groups: groups.map(g => ({
                groupId: g.groupId,
                ids: g.ids,
                originalNames: g.ids.map(id => materials.find(m => m.id === id)?.original_name || 'Unknown')
            })),
            percentage: 100,
            message: `Analisi completata: ${groups.length} gruppi trovati`
        });

        return {
            esito: true,
            groups,
            unmatchedIds,
            nonPdfIds,
        };
    }

    @Get("getPagineMaterialePDF")
    async getPagineMaterialePDF(
        @Query('id') id: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        try {
            const materiale = await this.materialiService.getMaterialeFromId(id);
            if (!materiale) {
                return res.status(404).send({
                    error: 'Material not found',
                    esito: false,
                    content: null
                });
            }

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                return res.status(500).send({
                    error: 'Invalid materials path',
                    esito: false,
                    content: null
                });
            }

            const pathFile = path.join(pathMateriale.path, materiale.file_name);
            if (!fs.existsSync(pathFile)) {
                return res.status(404).send({
                    error: 'File not found',
                    esito: false,
                    content: null
                });
            }

            // Get PDF info using pdf-lib
            const pageCount = await countPagePdf(pathFile);
            console.log(Colorize.bgMagenta(`Numero di pagine del file ${materiale.original_name}: ${pageCount}`));
            res.status(200).send({
                error: null,
                esito: true,
                content: {
                    pageCount: pageCount
                }
            });

        } catch (error) {
            console.error('Error getting pages of material PDF:', error);
            res.status(500).send({
                error: 'Error getting pages of material PDF',
                esito: false,
                content: null
            });
        }
    }

    @Get("generateAllThumbnails")
    async generateAllThumbnailsEndpoint(
        @Res() res: FastifyReply,
    ): Promise<void> {
        // Set up SSE headers
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        const sendEvent = (event: string, data: any) => {
            res.raw.write(`event: ${event}\n`);
            res.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            sendEvent('log', { type: 'info', message: 'Avvio generazione thumbnails per tutti i materiali PDF' });

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                sendEvent('error', { message: 'Path materiali non valido' });
                sendEvent('complete', { success: false });
                res.raw.end();
                return;
            }

            const thumbnailsDir = path.join(pathMateriale.path, 'thumbnails');
            if (!fs.existsSync(thumbnailsDir)) {
                fs.mkdirSync(thumbnailsDir, { recursive: true });
            }

            sendEvent('log', { type: 'success', message: `Cartella thumbnails: ${thumbnailsDir}` });

            const allMateriali = await this.materialiService.getAllMateriali();
            const pdfMateriali = allMateriali.filter(m =>
                path.extname(m.file_name).toLowerCase() === '.pdf' && m.pagine > 0
            );

            sendEvent('log', { type: 'info', message: `Trovati ${pdfMateriali.length} PDF da processare` });

            let processed = 0;
            let totalPages = 0;
            let errors = 0;

            for (const materiale of pdfMateriali) {
                processed++;
                const pathFile = path.join(pathMateriale.path, materiale.file_name);

                sendEvent('progress', {
                    current: processed,
                    total: pdfMateriali.length,
                    percentage: Math.round((processed / pdfMateriali.length) * 100),
                    fileName: materiale.original_name
                });

                if (!fs.existsSync(pathFile)) {
                    sendEvent('log', { type: 'warning', message: `File non trovato: ${materiale.original_name}` });
                    continue;
                }

                try {
                    const pageCount = materiale.pagine || await countPagePdf(pathFile);

                    for (let page = 1; page <= pageCount; page++) {
                        const thumbnailPath = path.join(thumbnailsDir, `${materiale.id}_page${page}.webp`);

                        if (fs.existsSync(thumbnailPath)) {
                            continue; // Skip se già esiste
                        }

                        const pngBuffer = await createThumbnailBufferPdf(pathFile, page, 150);
                        // Converti in WebP
                        const webpBuffer = await sharp(pngBuffer).webp({ quality: 80 }).toBuffer();
                        await fs.promises.writeFile(thumbnailPath, webpBuffer);
                        totalPages++;

                        sendEvent('page', {
                            materiale: materiale.original_name,
                            page: page,
                            totalPages: pageCount
                        });
                    }

                    sendEvent('log', { type: 'success', message: `Completato: ${materiale.original_name} (${pageCount} pagine)` });

                } catch (fileError: any) {
                    errors++;
                    sendEvent('log', { type: 'error', message: `Errore ${materiale.original_name}: ${fileError.message}` });
                }
            }

            sendEvent('summary', {
                processed,
                totalPages,
                errors
            });
            sendEvent('complete', { success: true });
            res.raw.end();

        } catch (error: any) {
            sendEvent('log', { type: 'error', message: `Errore fatale: ${error.message}` });
            sendEvent('complete', { success: false });
            res.raw.end();
        }
    }

    @Get("generateAllMaterialiSvg")
    async generateAllMaterialiSvg(
        @Query('force') force: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        const sendEvent = (event: string, data: any) => {
            res.raw.write(`event: ${event}\n`);
            res.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const forceRegenerate = ['1', 'true', 'yes', 'on'].includes((force || '').toLowerCase());

        try {
            sendEvent('log', { type: 'info', message: `Avvio generazione SVG per tutti i materiali PDF (force=${forceRegenerate})` });

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                sendEvent('error', { message: 'Path materiali non valido' });
                sendEvent('complete', { success: false });
                res.raw.end();
                return;
            }

            const svgDir = path.join(pathMateriale.path, 'svg');
            if (!fs.existsSync(svgDir)) {
                fs.mkdirSync(svgDir, { recursive: true });
            }

            const allMateriali = await this.materialiService.getAllMateriali();
            const pdfMateriali = allMateriali.filter((m) => path.extname(m.file_name).toLowerCase() === '.pdf');

            sendEvent('log', { type: 'info', message: `Trovati ${pdfMateriali.length} PDF da convertire in SVG` });

            let processed = 0;
            let generated = 0;
            let skipped = 0;
            let errors = 0;
            let totalPages = 0;

            for (const materiale of pdfMateriali) {
                processed++;
                const pdfPath = path.join(pathMateriale.path, materiale.file_name);

                sendEvent('progress', {
                    current: processed,
                    total: pdfMateriali.length,
                    percentage: Math.round((processed / pdfMateriali.length) * 100),
                    fileName: materiale.original_name,
                });

                if (!fs.existsSync(pdfPath)) {
                    errors++;
                    sendEvent('log', { type: 'warning', message: `File non trovato: ${materiale.original_name}` });
                    continue;
                }

                try {
                    const pageCount = await getMaterialPageCount(materiale, pdfPath);
                    const result = await generateAllSvgPages(
                        pdfPath,
                        materiale.id,
                        svgDir,
                        pageCount,
                        forceRegenerate,
                    );

                    generated += result.generated;
                    skipped += result.skipped;
                    errors += result.errors;
                    totalPages += pageCount;

                    sendEvent('log', {
                        type: result.errors > 0 ? 'warning' : 'success',
                        message: `Completato: ${materiale.original_name} (${pageCount} pagine, generate=${result.generated}, skip=${result.skipped}, errori=${result.errors})`,
                    });
                } catch (fileError: any) {
                    errors++;
                    sendEvent('log', { type: 'error', message: `Errore ${materiale.original_name}: ${fileError.message}` });
                }
            }

            sendEvent('summary', {
                processed,
                generated,
                skipped,
                errors,
                totalPages,
            });
            sendEvent('complete', { success: errors === 0 });
            res.raw.end();
        } catch (error: any) {
            sendEvent('log', { type: 'error', message: `Errore fatale: ${error.message}` });
            sendEvent('complete', { success: false });
            res.raw.end();
        }
    }

    @Get("updateAllMaterialiPagine")
    async updateAllMaterialiPagine(
        @Res() res: FastifyReply,
    ): Promise<void> {
        // Set up SSE headers
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        const sendEvent = (event: string, data: any) => {
            res.raw.write(`event: ${event}\n`);
            res.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            sendEvent('log', { type: 'info', message: 'Starting process to update all materials page count' });

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                sendEvent('error', { message: 'Invalid materials path' });
                sendEvent('complete', { success: false });
                res.raw.end();
                return;
            }

            sendEvent('log', { type: 'success', message: `Materials path found: ${pathMateriale.path}` });
            sendEvent('log', { type: 'info', message: 'Fetching all materials from database...' });

            const allMateriali = await this.materialiService.getAllMateriali();
            sendEvent('log', { type: 'info', message: `Found ${allMateriali.length} materials in database` });

            let processed = 0;
            let updated = 0;
            let skipped = 0;
            let errors = 0;

            for (const materiale of allMateriali) {
                processed++;
                sendEvent('progress', {
                    current: processed,
                    total: allMateriali.length,
                    percentage: Math.round((processed / allMateriali.length) * 100),
                    fileName: materiale.original_name
                });

                try {
                    const pathFile = path.join(pathMateriale.path, materiale.file_name);

                    // Check if file exists
                    if (!fs.existsSync(pathFile)) {
                        sendEvent('log', { type: 'warning', message: `File not found on disk: ${materiale.original_name}` });
                        skipped++;
                        continue;
                    }

                    // Check if file is a PDF
                    const ext = path.extname(materiale.file_name).toLowerCase();
                    if (ext !== '.pdf') {
                        sendEvent('log', { type: 'warning', message: `Not a PDF file, setting pagine to 0: ${materiale.original_name}` });
                        await this.materialiService.updateMaterialePagine(materiale.id, 0);
                        updated++;
                        continue;
                    }

                    // Count pages
                    sendEvent('log', { type: 'info', message: `Counting pages for: ${materiale.original_name}` });
                    const pageCount = await countPagePdf(pathFile);
                    sendEvent('log', { type: 'info', message: `Found ${pageCount} pages in ${materiale.original_name}` });

                    // Update database
                    const updateResult = await this.materialiService.updateMaterialePagine(materiale.id, pageCount);
                    if (updateResult) {
                        sendEvent('log', { type: 'success', message: `Successfully updated ${materiale.original_name} with ${pageCount} pages` });
                        updated++;
                    } else {
                        sendEvent('log', { type: 'error', message: `Failed to update database for ${materiale.original_name}` });
                        errors++;
                    }

                } catch (fileError: any) {
                    errors++;
                    sendEvent('log', { type: 'error', message: `Error processing material '${materiale.original_name}': ${fileError.message}` });
                }
            }

            sendEvent('log', { type: 'info', message: 'Process completed!' });
            sendEvent('summary', {
                processed,
                updated,
                skipped,
                errors
            });
            sendEvent('complete', { success: true });

            res.raw.end();

        } catch (error: any) {
            sendEvent('log', { type: 'error', message: `Fatal error: ${error.message}` });
            sendEvent('complete', { success: false });
            res.raw.end();
        }
    }

    @Post('uploadMateriale')
    async uploadMateriale(
        @Req() req: FastifyRequest<{ Body: { file: MultipartFile; json_meta_materiale: { value: JSONMetaFileMateriale } } }>,
        @Res() res: FastifyReply,
    ): Promise<void> {
        const file = req.body.file;
        let json_meta_materiale = req.body.json_meta_materiale.value;
        if (typeof json_meta_materiale === 'string') {
            json_meta_materiale = JSON.parse(json_meta_materiale) as JSONMetaFileMateriale;
        }

        if (file === undefined || json_meta_materiale === undefined) {
            res.send({ error: 'File or json_meta_materiale not found', esito: false, content: null });
            return;
        }

        const fileBuffer = await file.toBuffer();
        const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
        const tempFilePath = path.join(pathMateriale.path, 'test.pdf');

        try {
            // Write temporary file
            await fs.promises.writeFile(tempFilePath, fileBuffer);

            // Calculate MD5 hash
            let md5File: string;
            const pages = await countPagePdf(tempFilePath);
            if (pages <= 1) {
                md5File = await cleanAndHashPdf(tempFilePath);
            } else {
                md5File = crypto.createHash("md5").update(fileBuffer).digest('hex');
            }
            console.log(md5File);

            // Clean up temporary file
            try {
                await fs.promises.unlink(tempFilePath);
            } catch (unlinkError) {
                console.warn(`Failed to delete temporary file: ${unlinkError.message}`);
            }

            // Generate unique filename
            const uniqueFileName = `${uuidv4()}${path.extname(file.filename)}`;
            const pathFile = path.join(pathMateriale.path, uniqueFileName);

            // Ensure directory exists
            if (!fs.existsSync(pathMateriale.path)) {
                fs.mkdirSync(pathMateriale.path, { recursive: true });
            }

            // Check if file already exists
            const checkIfExist = await this.materialiService.checkFileMaterialeExistFromMD5(md5File);
            if (checkIfExist !== null) {
                console.log(Colorize.bgMagenta(`File già presente: ${file.filename} con hash ${md5File.toUpperCase()}`));
                res.send({
                    esito: true,
                    error: "",
                    content: checkIfExist.toJSON()
                });
                return;
            }

            // Create new material record
            const materiale = new Materiali();
            materiale.id = uuidv4();
            materiale.id_path_materiali = pathMateriale.id;
            materiale.file_name = uniqueFileName;
            materiale.original_name = file.filename;
            materiale.md5 = md5File;
            materiale.pagine = pages;

            // Handle JSON metadata
            if (json_meta_materiale.JsonMeta) {
                materiale.json_meta = typeof json_meta_materiale.JsonMeta === 'string'
                    ? JSON.parse(json_meta_materiale.JsonMeta)
                    : json_meta_materiale.JsonMeta;
            }

            // Save material record
            const result = await this.materialiService.creaMaterialeRecord(materiale);
            if (!result.created) {
                throw new HttpException(result.error, HttpStatus.INTERNAL_SERVER_ERROR);
            }

            // Write final file
            await fs.promises.writeFile(pathFile, fileBuffer);

            // Pre-genera le thumbnail per i PDF (in background, non blocca la risposta)
            const ext = path.extname(file.filename).toLowerCase();
            if (ext === '.pdf' && pages > 0) {
                const thumbnailsDir = path.join(pathMateriale.path, 'thumbnails');
                const svgDir = path.join(pathMateriale.path, 'svg');
                // Genera in background senza await per non bloccare la risposta
                generateAllThumbnails(pathFile, materiale.id, thumbnailsDir, pages, 150)
                    .catch(err => console.error(Colorize.bgRed(`[uploadMateriale] Errore generazione thumbnails: ${err.message}`)));
                generateAllSvgPages(pathFile, materiale.id, svgDir, pages, false)
                    .catch(err => console.error(Colorize.bgRed(`[uploadMateriale] Errore generazione svg: ${err.message}`)));
            }

            res.send({
                esito: true,
                error: "",
                content: materiale.toJSON()
            });

        } catch (error) {
            console.error(error);
            throw new HttpException('Error processing file', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('getThumbnailMaterialePdfs')
    async getThumbnailMaterialePdfs(
        @Query('id') id: string,
        @Query('page') page: string,
        @Query('width') width: string,
        @Query('height') height: string,
        @Query('svg') svg: string,
        @Res() res: FastifyReply,
    ) {
        const wantSvg = ['1', 'true', 'yes', 'on'].includes((svg || '').toLowerCase());
        console.log(Colorize.bgBlue(`[getThumbnailMaterialePdfs] Starting request with params: id=${id}, page=${page}, width=${width}, height=${height}, svg=${wantSvg}`));
        try {
            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Fetching material with id: ${id}`));
            const materiale = await this.materialiService.getMaterialeFromId(id);
            if (!materiale) {
                console.log(Colorize.bgRed(`[getThumbnailMaterialePdfs] Material not found for id: ${id}, returning no foto`));

                if (wantSvg) {
                    res.status(HttpStatus.NOT_FOUND).send({ error: 'Material not found', esito: false, content: null });
                    return;
                }

                // Restituisce l'immagine "no foto" invece dell'errore
                const noFotoPath = path.join(process.cwd(), 'nofoto.jpg');
                if (!fs.existsSync(noFotoPath)) {
                    console.log(Colorize.bgRed(`[getThumbnailMaterialePdfs] No foto file not found: ${noFotoPath}`));
                    res.status(HttpStatus.NOT_FOUND).send({ error: 'Material and no foto not found', esito: false, content: null });
                    return;
                }

                console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Processing no foto image with sharp`));
                const image = sharp(noFotoPath);
                if (width && height) {
                    console.log(Colorize.bgBlue(`[getThumbnailMaterialePdfs] Resizing no foto image to: ${width}x${height}`));
                    image.resize(parseInt(width), parseInt(height));
                }

                console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Setting response headers for no foto`));
                res.raw.setHeader('Content-Type', 'image/jpeg');
                res.raw.setHeader("Cache-Control", "public, max-age=31536000");

                console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Converting no foto image to buffer`));
                const buffer = await image.toBuffer();
                console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] Sending no foto response with buffer size: ${buffer.length} bytes`));
                res.raw.end(buffer);
                return;
            }
            console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] Material found: ${materiale.original_name}`));

            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Getting material path`));
            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale || !fs.existsSync(pathMateriale.path)) {
                console.log(Colorize.bgRed(`[getThumbnailMaterialePdfs] Path not found: ${pathMateriale?.path}`));
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Path not found', esito: false, content: null });
                return;
            }
            console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] Path found: ${pathMateriale.path}`));

            const pathFile = path.join(pathMateriale.path, materiale.file_name);
            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Checking if file exists: ${pathFile}`));
            if (!fs.existsSync(pathFile)) {
                console.log(Colorize.bgRed(`[getThumbnailMaterialePdfs] File not found: ${pathFile}`));
                res.status(HttpStatus.NOT_FOUND).send({ error: 'File not found', esito: false, content: null });
                return;
            }
            console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] File exists: ${pathFile}`));

            const pageNum = Number.parseInt(page, 10) || 1;
            if (pageNum < 1) {
                res.status(HttpStatus.BAD_REQUEST).send({ error: 'Invalid page. Page must be >= 1', esito: false, content: null });
                return;
            }

            const ext = path.extname(materiale.file_name).toLowerCase();
            if (ext !== '.pdf') {
                res.status(HttpStatus.BAD_REQUEST).send({ error: 'Material is not a PDF', esito: false, content: null });
                return;
            }

            const pageCount = await getMaterialPageCount(materiale, pathFile);
            if (pageNum > pageCount) {
                res.status(HttpStatus.BAD_REQUEST).send({
                    error: `Invalid page ${pageNum}. Valid range: 1-${pageCount}`,
                    esito: false,
                    content: null,
                });
                return;
            }

            if (wantSvg) {
                const svgPath = await ensureSvgPageCached({
                    pdfPath: pathFile,
                    svgDir: path.join(pathMateriale.path, 'svg'),
                    materialeId: id,
                    page: pageNum,
                });

                const svgContent = await fs.promises.readFile(svgPath, 'utf8');
                res.raw.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
                res.raw.setHeader('Cache-Control', 'public, max-age=3600');
                res.raw.end(svgContent);
                return;
            }

            const thumbnailsDir = path.join(pathMateriale.path, 'thumbnails');
            const cachedPath = getCachedThumbnailPath(thumbnailsDir, id, pageNum);

            let thumbnailBuffer: Buffer;

            if (cachedPath) {
                // Usa la thumbnail pre-generata dalla cache (già in WebP)
                console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] Usando thumbnail cached: ${cachedPath}`));
                thumbnailBuffer = await fs.promises.readFile(cachedPath);
            } else {
                // Genera al volo (fallback) e salva per le prossime richieste
                console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Thumbnail non in cache, generazione al volo`));
                const pngBuffer = await createThumbnailBufferPdf(pathFile, pageNum, 150);
                // Converti in WebP
                thumbnailBuffer = await sharp(pngBuffer).webp({ quality: 80 }).toBuffer();

                // Salva in cache per le prossime richieste (in background)
                if (!fs.existsSync(thumbnailsDir)) {
                    fs.mkdirSync(thumbnailsDir, { recursive: true });
                }
                const thumbnailPath = path.join(thumbnailsDir, `${id}_page${pageNum}.webp`);
                fs.promises.writeFile(thumbnailPath, thumbnailBuffer)
                    .catch(err => console.error(Colorize.bgRed(`[getThumbnailMaterialePdfs] Errore salvataggio cache: ${err.message}`)));
            }
            console.log(Colorize.bgMagenta(`[getThumbnailMaterialePdfs] Thumbnail pronta per file: ${materiale.original_name}`));

            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Processing image with sharp`));
            let image = sharp(thumbnailBuffer);
            if (width && height) {
                console.log(Colorize.bgBlue(`[getThumbnailMaterialePdfs] Resizing image to: ${width}x${height}`));
                image = image.resize(parseInt(width), parseInt(height));
            }

            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Setting response headers`));
            res.raw.setHeader('Content-Type', 'image/webp');
            res.raw.setHeader("Cache-Control", "public, max-age=31536000");

            console.log(Colorize.bgYellow(`[getThumbnailMaterialePdfs] Converting image to buffer`));
            const buffer = await image.toBuffer();
            console.log(Colorize.bgGreen(`[getThumbnailMaterialePdfs] Sending response with buffer size: ${buffer.length} bytes`));
            res.raw.end(buffer);

        } catch (error: any) {
            console.error(Colorize.bgRed(`[getThumbnailMaterialePdfs] Error: ${error.message}`));
            console.error(Colorize.bgRed(`[getThumbnailMaterialePdfs] Stack trace: ${error.stack}`));
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Error getting thumbnail ' + error.message, esito: false, content: null });
        }
    }



    @Get('getMaterialePDF')
    async getMaterialePDF(
        @Query('id') id: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        try {
            const materiale = await this.materialiService.getMaterialeFromId(id);
            if (!materiale) {
                return res.status(404).send({
                    error: 'Material not found',
                    esito: false,
                    content: null
                });
            }

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                return res.status(500).send({
                    error: 'Invalid materials path',
                    esito: false,
                    content: null
                });
            }

            const pathFile = path.join(pathMateriale.path, materiale.file_name);

            try {
                await fs.promises.access(pathFile, fs.constants.R_OK);
            } catch {
                return res.status(404).send({
                    error: 'File not accessible',
                    esito: false,
                    content: null
                });
            }

            const stat = await fs.promises.stat(pathFile);
            const mimeType = mime.lookup(pathFile) || 'application/octet-stream';
            const fileSize = stat.size;

            const range = res.request.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize) {
                    return res.status(416).header('Content-Range', `bytes */${fileSize}`).send();
                }

                const chunksize = Math.min((end - start) + 1, fileSize - start);

                res.raw.statusCode = 206;
                res.raw.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
                res.raw.setHeader('Accept-Ranges', 'bytes');
                res.raw.setHeader('Content-Length', chunksize);
                res.raw.setHeader('Content-Type', mimeType);

                const fileStream = fs.createReadStream(pathFile, { start, end });
                fileStream.pipe(res.raw);
            } else {
                res.raw.statusCode = 200;
                res.raw.setHeader('Content-Length', fileSize);
                res.raw.setHeader('Content-Type', mimeType);
                res.raw.setHeader('Accept-Ranges', 'bytes');
                const fileStream = fs.createReadStream(pathFile);
                fileStream.pipe(res.raw);
            }
        } catch (error) {
            console.error('PDF Streaming Error:', error);
            res.status(500).send({
                error: `Internal streaming error: ${error.message}`,
                esito: false,
                content: null
            });
        }
    }

    @Get('getMaterialeSVG')
    async getMaterialeSVGById(
        @Query('id') id: string,
        @Query('page') page: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        try {
            const materiale = await this.materialiService.getMaterialeFromId(id);
            if (!materiale) {
                res.status(HttpStatus.NOT_FOUND).send({
                    error: 'Material not found',
                    esito: false,
                    content: null,
                });
                return;
            }

            const ext = path.extname(materiale.file_name).toLowerCase();
            if (ext !== '.pdf') {
                res.status(HttpStatus.BAD_REQUEST).send({
                    error: 'Material is not a PDF',
                    esito: false,
                    content: null,
                });
                return;
            }

            const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
            if (!pathMateriale?.path) {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
                    error: 'Invalid materials path',
                    esito: false,
                    content: null,
                });
                return;
            }

            const pdfPath = path.join(pathMateriale.path, materiale.file_name);
            const pageNum = Number.parseInt(page, 10) || 1;
            if (pageNum < 1) {
                res.status(HttpStatus.BAD_REQUEST).send({
                    error: 'Invalid page. Page must be >= 1',
                    esito: false,
                    content: null,
                });
                return;
            }

            try {
                await fs.promises.access(pdfPath, fs.constants.R_OK);
            } catch {
                res.status(HttpStatus.NOT_FOUND).send({
                    error: 'PDF file not accessible',
                    esito: false,
                    content: null,
                });
                return;
            }

            const pageCount = await getMaterialPageCount(materiale, pdfPath);
            if (pageNum > pageCount) {
                res.status(HttpStatus.BAD_REQUEST).send({
                    error: `Invalid page ${pageNum}. Valid range: 1-${pageCount}`,
                    esito: false,
                    content: null,
                });
                return;
            }

            const svgPath = await ensureSvgPageCached({
                pdfPath,
                svgDir: path.join(pathMateriale.path, 'svg'),
                materialeId: id,
                page: pageNum,
            });
            const svgContent = await fs.promises.readFile(svgPath, 'utf8');

            res.status(HttpStatus.OK).headers({
                'Content-Type': 'image/svg+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            });
            res.raw.end(svgContent);
        } catch (error: any) {
            console.error('SVG conversion error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
                error: `Error converting PDF to SVG: ${error.message}`,
                esito: false,
                content: null,
            });
        }
    }
    // @Get("ripara_materiale_pdf_da_cartella")
    // async ripara_materiale_pdf_da_cartella(
    //     @Res() res: FastifyReply,
    // ): Promise<void> {

    //     console.log(Colorize.bgBlue(`[ripara_materiale_pdf_da_cartella] Start`));
    //     try {
    //         console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Fetching absolute path for MATERIALI`));
    //         const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
    //         if (!pathMateriale?.path) {
    //             console.log(Colorize.bgRed(`[ripara_materiale_pdf_da_cartella] Invalid materials path`));
    //             return res.status(500).send({
    //                 error: 'Invalid materials path',
    //                 esito: false,
    //                 content: null
    //             });
    //         }

    //         console.log(Colorize.bgGreen(`[ripara_materiale_pdf_da_cartella] Path found: ${pathMateriale.path}`));
    //         console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Reading directory...`));

    //         const files = await fs.promises.readdir(pathMateriale.path);
    //         console.log(Colorize.bgMagenta(`[ripara_materiale_pdf_da_cartella] Files found: ${files.length}`));

    //         let processed = 0;
    //         let updated = 0;
    //         let skipped = 0;
    //         let errors = 0;

    //         for (const fileName of files) {
    //             const filePath = path.join(pathMateriale.path, fileName);
    //             console.log(Colorize.bgBlue(`[ripara_materiale_pdf_da_cartella] Processing file: ${fileName}`));
    //             processed++;

    //             try {
    //                 const stat = await fs.promises.stat(filePath);
    //                 if (!stat.isFile()) {
    //                     console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Skipping non-file: ${fileName}`));
    //                     skipped++;
    //                     continue;
    //                 }

    //                 // Only consider PDFs
    //                 const ext = path.extname(fileName).toLowerCase();
    //                 if (ext !== '.pdf') {
    //                     console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Skipping non-PDF: ${fileName}`));
    //                     skipped++;
    //                     continue;
    //                 }

    //                 console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Reading file for MD5: ${fileName}`));
    //                 const buffer = await fs.promises.readFile(filePath);
    //                 const file_md5 = crypto.createHash("md5").update(buffer).digest("hex");
    //                 console.log(Colorize.bgMagenta(`[ripara_materiale_pdf_da_cartella] MD5 computed: ${file_md5}`));

    //                 console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] Checking DB by MD5`));
    //                 const materiale = await this.materialiService.checkFileMaterialeExistFromMD5(file_md5);

    //                 if (materiale) {
    //                     console.log(Colorize.bgGreen(`[ripara_materiale_pdf_da_cartella] Match found. Updating file_name from '${materiale.file_name}' to '${fileName}'`));
    //                     materiale.file_name = fileName;
    //                     await materiale.save();
    //                     updated++;
    //                     console.log(Colorize.bgGreen(`[ripara_materiale_pdf_da_cartella] Update OK for MD5: ${file_md5}`));
    //                 } else {
    //                     console.log(Colorize.bgYellow(`[ripara_materiale_pdf_da_cartella] No DB record for MD5: ${file_md5}. Skipping file: ${fileName}`));
    //                     skipped++;
    //                 }
    //             } catch (fileError: any) {
    //                 errors++;
    //                 console.error(Colorize.bgRed(`[ripara_materiale_pdf_da_cartella] Error processing file '${fileName}': ${fileError.message}`));
    //             }
    //         }

    //         console.log(Colorize.bgBlue(`[ripara_materiale_pdf_da_cartella] Completed. Processed=${processed}, Updated=${updated}, Skipped=${skipped}, Errors=${errors}`));

    //         return res.status(200).send({
    //             error: null,
    //             esito: true,
    //             content: {
    //                 processed,
    //                 updated,
    //                 skipped,
    //                 errors
    //             }
    //         });
    //     } catch (error: any) {
    //         console.error(Colorize.bgRed(`[ripara_materiale_pdf_da_cartella] Fatal error: ${error.message}`));
    //         return res.status(500).send({
    //             error: 'Internal server error',
    //             esito: false,
    //             content: null
    //         });
    //     }
    // }

    @Post('/uploadVideoBase')
    async uploadVideoBase(
        @Req() req: FastifyRequest<{
            Body: {
                file: MultipartFile; data: {
                    value: {
                        id: string, device: string, type: string
                    } | string
                }
            }
        }>,
        @Res() res: FastifyReply,

    ): Promise<void> {
        try {
            const file = req.body.file;
            const data = JSON.parse(req.body.data.value as string);

            if (!file || !data) {
                res.status(HttpStatus.BAD_REQUEST).send({ error: 'File or data not found', esito: false, content: null });
                return;
            }

            const fileBuffer = await file.toBuffer();
            const md5File = crypto.createHash("md5").update(fileBuffer).digest("hex");
            const uniqueFileName = `${uuidv4()}${path.extname(file.filename)}`;

            const pathVideo = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.VIDEO);
            const uploadCheckFile = path.join(pathVideo.path, uniqueFileName.replace(path.extname(file.filename), '.txt'));
            if (!fs.existsSync(pathVideo.path)) {
                fs.mkdirSync(pathVideo.path, { recursive: true });
            }

            const pathFile = path.join(pathVideo.path, uniqueFileName);

            const checkIfExist = await this.materialiService.checkFileVideoExistFromMD5(md5File);
            if (checkIfExist) {
                return res.send({
                    esito: true,
                    error: '',
                    content: {
                        id: data.id,
                        device: data.device,
                        type: data.type,
                        file: checkIfExist.id,
                    },

                });
            } else {
                const video: VideoAttributes = {
                    id: uuidv4(),
                    id_path_video: pathVideo.id,
                    file_name: uniqueFileName,
                    original_name: file.filename,
                    md5: md5File,
                    json_meta_video: JSON.stringify(data),
                }

                const result = await this.materialiService.creaVideoRecord(video);
                if (!result.created) {
                    throw new HttpException(result.error, HttpStatus.INTERNAL_SERVER_ERROR);
                }

                await fs.promises.writeFile(pathFile, fileBuffer);
                res.send({
                    esito: true,
                    error: '',
                    content: {
                        id: data.id,
                        device: data.device,
                        type: data.type,
                        file: video.id,
                    },
                });
            }
        } catch (error) {
            console.error(error);
            res.status(500).send({ error: 'Error uploading video', esito: false, content: null });
        }
    }


    @Get("/getVideoOnDemand")
    async getVideoOnDemand(
        @Query('guidId') guidId: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        try {
            if (!guidId) {
                res.status(HttpStatus.BAD_REQUEST).send({ error: 'GuidId not found', esito: false, content: null });
                return;
            }

            const video = await this.materialiService.getVideoFromGuidId(guidId);
            if (!video) {
                res.status(HttpStatus.NOT_FOUND).send({ error: 'Video not found', esito: false, content: null });
                return;
            }

            const pathVideo = await this.olimpoService.getPathVideoFromID(video.id);
            if (!pathVideo || !fs.existsSync(pathVideo)) {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Path not found', esito: false, content: null });
                return;
            }

            const stat = fs.statSync(pathVideo);
            const fileSize = stat.size;
            const range = res.request.headers.range;

            if (range) {
                // Gestione della richiesta Range
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize) {
                    res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                        .header('Content-Range', `bytes */${fileSize}`)
                        .send();
                    return;
                }

                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(pathVideo, { start, end });
                const headers = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4',
                };

                res.status(HttpStatus.PARTIAL_CONTENT).headers(headers);
                res.raw.writeHead(HttpStatus.PARTIAL_CONTENT, headers);
                file.pipe(res.raw);
            } else {
                // Streaming dell'intero file
                const headers = {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': `inline; filename="${video.original_name}"`,
                    'Cache-Control': 'public, max-age=31536000',
                };

                res.headers(headers);
                const file = fs.createReadStream(pathVideo);
                file.pipe(res.raw);
            }
        } catch (error) {
            console.error(error);
            res.status(500).send({ error: 'Error streaming video ' + error.message, esito: false, content: null });
        }
    }

    @Post('getZipMateriali')
    async getZipMateriali(
        @Req() req: FastifyRequest<{ Body: { filesItem: FileItemKit[] | string } }>,
        @Res() res: FastifyReply,
    ): Promise<void> {
        let files = req.body.filesItem;
        if (typeof files === 'string') {
            files = JSON.parse(files) as FileItemKit[];
        }

        const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
        if (pathMateriale == undefined) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Path not found', esito: false, content: null });
            return;
        }
        const ids = files.map((file) => file.id_olimpo_cloud);
        const allMateriali = await this.materialiService.getAllMaterliFromIds(ids);
        const zip = new AdmZip();

        await Promise.all(allMateriali.map(async (materiale) => {
            const pathFile = path.join(pathMateriale.path, materiale.file_name);
            if (!fs.existsSync(pathFile)) {
                res.status(HttpStatus.NOT_FOUND).send({ error: 'File not found', esito: false, content: null });
                return;
            }
            // Aggiungi il file allo zip
            zip.addLocalFile(pathFile);
        }));

        const zipName = `${uuidv4()}.zip`;
        const zipPath = path.join(pathMateriale.path, zipName);
        await zip.writeZipPromise(zipPath);
        res.raw.setHeader('Content-Type', 'application/zip');
        res.raw.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
        const zipStream = fs.createReadStream(zipPath);
        zipStream.pipe(res.raw);
        zipStream.on('end', async () => {
            await fs.promises.unlink(zipPath);
        });
    }


    @Post('uploadMaterialeTest')
    async uploadMaterialeTest(
        @Req() req: FastifyRequest<{ Body: { file: MultipartFile; json_meta_materiale: { value: JSONMetaFileMateriale } } }>,
        @Res() res: FastifyReply,
    ): Promise<void> {

        const file = req.body.file;
        let json_meta_materiale = req.body.json_meta_materiale.value;
        if (typeof json_meta_materiale === 'string') {
            json_meta_materiale = JSON.parse(json_meta_materiale) as JSONMetaFileMateriale;
        }

        if (file === undefined || json_meta_materiale === undefined) {
            res.send({ error: 'File or json_meta_materiale not found', esito: false, content: null });
            return;
        }
        const fileBuffer = await file.toBuffer();
        const md5File = crypto.createHash("md5").update(fileBuffer).digest('hex');
        if (json_meta_materiale.FileHash) {
            if (json_meta_materiale.FileHash !== md5File) {
                res.send({ error: 'File hash mismatch', esito: false, content: null });
                return;
            }
        }
        const uniqueFileName = `${uuidv4()}${path.extname(file.filename)}`;


        const pathMateriale = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
        if (fs.existsSync(pathMateriale.path) === false) {
            fs.mkdirSync(pathMateriale.path, { recursive: true });
        }
        const pathFile = path.join(pathMateriale.path, uniqueFileName);

        const checkIfExist = await this.materialiService.checkFileMaterialeExistFromMD5(md5File);
        try {
            if (checkIfExist !== null) {
                console.log(Colorize.bgMagenta(`File già presente: ${file.filename} con hash ${md5File.toUpperCase()}`));
                res.send({
                    esito: true,
                    error: "",
                    content: checkIfExist.toJSON()
                });
                return;
            } else {
                let materiale = new Materiali();
                materiale.id = uuidv4();
                materiale.id_path_materiali = pathMateriale.id;
                materiale.file_name = uniqueFileName;
                materiale.original_name = file.filename;
                materiale.md5 = md5File;
                if (json_meta_materiale.JsonMeta) {
                    if (typeof json_meta_materiale.JsonMeta === 'string') {
                        json_meta_materiale.JsonMeta = JSON.parse(json_meta_materiale.JsonMeta);
                    }
                }
                materiale.json_meta = json_meta_materiale.JsonMeta;
                const result = await this.materialiService.creaMaterialeRecord(materiale);
                if (result.created === false) {
                    throw new HttpException(result.error, HttpStatus.INTERNAL_SERVER_ERROR);
                } else {
                    await fs.promises.writeFile(pathFile, fileBuffer);

                    const ext = path.extname(file.filename).toLowerCase();
                    if (ext === '.pdf') {
                        (async () => {
                            try {
                                const pageCount = await countPagePdf(pathFile);
                                if (pageCount > 0) {
                                    const thumbnailsDir = path.join(pathMateriale.path, 'thumbnails');
                                    const svgDir = path.join(pathMateriale.path, 'svg');
                                    await generateAllThumbnails(pathFile, materiale.id, thumbnailsDir, pageCount, 150);
                                    await generateAllSvgPages(pathFile, materiale.id, svgDir, pageCount, false);
                                }
                            } catch (err: any) {
                                console.error(Colorize.bgRed(`[uploadMaterialeTest] Errore pre-generazione PDF assets: ${err.message}`));
                            }
                        })();
                    }

                    res.send({
                        esito: true,
                        error: "",
                        content: materiale.toJSON()
                    })
                }
            }
        } catch (error) {
            console.error(error);
            throw new HttpException('Error writing file', HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }
    @Post("groupPDFsByEquality")
    async groupPDFsByEqualityEndpoint(
        @Req() req: FastifyRequest<{ Body: { ids: string[]; socketId?: string } }>,
        @Res() res: FastifyReply,
    ) {
        return this.checkForPDFEquality(req, res);
    }

    @Post("checkForPDFEquality")
    async checkForPDFEquality(
        @Req() req: FastifyRequest<{ Body: { ids: string[]; socketId?: string } }>,
        @Res() res: FastifyReply,
    ) {
        const ids = req.body.ids;
        const socketId = req.body.socketId;
        try {
            const result = await this.groupPDFsByEquality(ids, socketId);
            if (!result.esito) {
                if (result.error === 'Invalid ids array') {
                    console.error(Colorize.bgRed(`[checkForPDFEquality] Invalid ids array: ${JSON.stringify(ids)}`));
                    res.status(HttpStatus.BAD_REQUEST).send(result);
                    return;
                }
                if (result.error === 'No materials found for provided ids') {
                    console.warn(Colorize.bgYellow(`[checkForPDFEquality] No materials found for provided ids: ${JSON.stringify(ids)}`));
                    res.status(HttpStatus.NOT_FOUND).send(result);
                    return;
                }
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(result);
                return;
            }

            res.send(result);
        } catch (error) {
            console.error(error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ esito: false, error: 'Error checking file equality' });
        }
    }
}






function getWindowsGhostscriptExecutables(): string[] {
    const resolvedExecutables: string[] = [];
    const seen = new Set<string>();
    const addExecutable = (executablePath: string) => {
        if (!seen.has(executablePath)) {
            seen.add(executablePath);
            resolvedExecutables.push(executablePath);
        }
    };

    const programRoots = [process.env['ProgramW6432'], process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]
        .filter((entry): entry is string => Boolean(entry));

    for (const root of programRoots) {
        const gsRoot = path.join(root, 'gs');
        if (!fs.existsSync(gsRoot)) {
            continue;
        }

        const versionFolders = fs.readdirSync(gsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
            .reverse();

        for (const version of versionFolders) {
            const binFolder = path.join(gsRoot, version, 'bin');
            const gs64 = path.join(binFolder, 'gswin64c.exe');
            const gs32 = path.join(binFolder, 'gswin32c.exe');

            if (fs.existsSync(gs64)) {
                addExecutable(gs64);
            }
            if (fs.existsSync(gs32)) {
                addExecutable(gs32);
            }
        }
    }

    // Fallback su PATH per installazioni custom o ambienti non standard.
    addExecutable('gswin64c');
    addExecutable('gswin32c');
    addExecutable('gswin64');
    addExecutable('gswin32');
    addExecutable('gs');

    return resolvedExecutables;
}

// Cache della versione major di Ghostscript per eseguibile
const _gsVersionCache = new Map<string, number>();

function getGsMajorVersion(executable: string): Promise<number> {
    if (_gsVersionCache.has(executable)) {
        return Promise.resolve(_gsVersionCache.get(executable)!);
    }
    return new Promise((resolve) => {
        const proc = spawn(executable, ['--version']);
        let output = '';
        proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
        proc.on('close', () => {
            const match = output.trim().match(/^(\d+)/);
            const version = match ? parseInt(match[1], 10) : 9;
            _gsVersionCache.set(executable, version);
            console.log(`Ghostscript version rilevata per ${executable}: ${version}`);
            resolve(version);
        });
        proc.on('error', () => {
            // Se l'eseguibile non esiste, lo segniamo come 9 (default safe)
            _gsVersionCache.set(executable, 9);
            resolve(9);
        });
    });
}

function runGsProcess(executable: string, args: string[], label = 'Ghostscript'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        console.log(`Eseguendo ${label}: ${executable} ${args.join(' ')}`);
        const chunks: Buffer[] = [];
        const errorChunks: Buffer[] = [];
        const proc = spawn(executable, args);
        proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
        proc.stderr.on('data', (chunk: Buffer) => {
            errorChunks.push(chunk);
            console.error(`${label} stderr: ${chunk.toString()}`);
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            if (code !== 0) {
                const errorMsg = Buffer.concat(errorChunks).toString();
                reject(new Error(`Ghostscript è terminato con il codice ${code}. Errore: ${errorMsg}`));
                return;
            }
            resolve(Buffer.concat(chunks));
        });
    });
}

/**
 * Crea una thumbnail da un PDF e restituisce il buffer dell'immagine.
 *
 * @param pdfPath - Il percorso del file PDF.
 * @param page - La pagina da convertire (default: 1).
 * @param density - La densità (dpi) per la conversione (default: 150).
 * @returns Una Promise che risolve con il buffer dell'immagine.
 */
async function createThumbnailBufferPdf(pdfPath: string, page: number = 1, density: number = 150): Promise<Buffer> {
    const isWindows = process.platform === 'win32';
    const normalizedPath = isWindows ? pdfPath.replace(/\\/g, '/') : pdfPath;
    const executables = isWindows ? getWindowsGhostscriptExecutables() : ['gs'];
    let lastError: Error = new Error('Ghostscript non trovato');

    for (const executable of executables) {
        try {
            const majorVersion = await getGsMajorVersion(executable);
            // GS 9.x: -dSAFER è sufficiente e richiesto
            // GS 10.x: -dNOSAFER necessario per alcuni PDF con restrizioni
            const safeFlag = majorVersion >= 10 ? '-dNOSAFER' : '-dSAFER';
            const args = [
                '-q',
                safeFlag,
                '-dBATCH',
                '-dNOPAUSE',
                '-sDEVICE=png16m',
                `-dFirstPage=${page}`,
                `-dLastPage=${page}`,
                `-r${density}`,
                '-sOutputFile=-',
                normalizedPath,
            ];
            return await runGsProcess(executable, args, 'Ghostscript thumbnail');
        } catch (err) {
            lastError = err as Error;
            if (!isWindows) throw lastError;
            // Su Windows proviamo il prossimo eseguibile
        }
    }
    throw lastError;
}

async function countPagePdf(filePath: string): Promise<number> {
    const isWindows = process.platform === 'win32';
    const normalizedPath = isWindows ? filePath.replace(/\\/g, '/') : filePath;
    const pathForFs = isWindows ? normalizedPath.replace(/\//g, '\\') : normalizedPath;

    if (!fs.existsSync(pathForFs)) {
        throw new Error(`File PDF non trovato: ${normalizedPath}`);
    }

    const executables = isWindows ? getWindowsGhostscriptExecutables() : ['gs'];
    let lastError: Error = new Error('Ghostscript non trovato');

    for (const executable of executables) {
        try {
            const majorVersion = await getGsMajorVersion(executable);
            let args: string[];
            // Istanta4, 4/9/2026: la soglia era >= 10, ma il ramo "classico" con -f
            // fallisce con lo stesso /stackunderflow anche su Ghostscript 9.55.
            // Verificato sul server demo: con -f errore irrecuperabile, con la forma
            // PostScript il conteggio torna corretto. Il ramo sotto resta per
            // eventuali versioni piu' vecchie della 9.
            if (majorVersion >= 9) {
                // -f lascia lo stack PostScript vuoto → /stackunderflow su runpdfbegin.
                // Si apre il file direttamente tramite PostScript con (path) (r) file.
                args = [
                    '-q',
                    '-dNOSAFER',
                    '-dNOPAUSE',
                    '-dBATCH',
                    '-dNODISPLAY',
                    '-c',
                    `(${normalizedPath}) (r) file runpdfbegin pdfpagecount = quit`,
                ];
            } else {
                // GS 9.x: approccio classico con -f e -dSAFER
                args = [
                    '-q',
                    '-dSAFER',
                    '-dNOPAUSE',
                    '-dBATCH',
                    '-dNODISPLAY',
                    '-f',
                    normalizedPath,
                    '-c',
                    'runpdfbegin pdfpagecount = quit',
                ];
            }

            const output = await runGsProcess(executable, args, 'Ghostscript conteggio pagine');
            const pageCount = parseInt(output.toString().trim(), 10);
            if (isNaN(pageCount) || pageCount <= 0) {
                throw new Error('Impossibile determinare il numero di pagine');
            }
            return pageCount;
        } catch (err) {
            lastError = err as Error;
            if (!isWindows) throw lastError;
            // Su Windows proviamo il prossimo eseguibile
        }
    }
    throw lastError;
}

async function cleanAndHashPdf(pdfPath: string): Promise<string> {
    try {
        const pageCount = await countPagePdf(pdfPath);
        const pdfBuffer = await createThumbnailBufferPdf(pdfPath, 1, 150);
        const md5 = crypto.createHash('md5').update(pdfBuffer).digest('hex');
        return md5;
    } catch (error) {
        console.error(error);
    }
}

/**
 * Pre-genera tutte le thumbnail PNG di un PDF e le salva su disco.
 * Le thumbnail vengono salvate nella sottocartella "thumbnails" con naming: {materialeId}_page{N}.png
 *
 * @param pdfPath - Percorso del file PDF
 * @param materialeId - ID univoco del materiale (usato per il naming dei file)
 * @param thumbnailsDir - Cartella dove salvare le thumbnail
 * @param pageCount - Numero totale di pagine del PDF
 * @param density - Risoluzione DPI (default: 150)
 */
async function generateAllThumbnails(
    pdfPath: string,
    materialeId: string,
    thumbnailsDir: string,
    pageCount: number,
    density: number = 150
): Promise<void> {
    // Crea la cartella thumbnails se non esiste
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    console.log(Colorize.bgBlue(`[generateAllThumbnails] Generazione ${pageCount} thumbnail WebP per materiale ${materialeId}`));

    for (let page = 1; page <= pageCount; page++) {
        const thumbnailPath = path.join(thumbnailsDir, `${materialeId}_page${page}.webp`);

        // Salta se la thumbnail esiste già
        if (fs.existsSync(thumbnailPath)) {
            console.log(Colorize.bgYellow(`[generateAllThumbnails] Thumbnail pagina ${page} già esistente, skip`));
            continue;
        }

        try {
            const pngBuffer = await createThumbnailBufferPdf(pdfPath, page, density);
            // Converti PNG in WebP con sharp
            const webpBuffer = await sharp(pngBuffer).webp({ quality: 80 }).toBuffer();
            await fs.promises.writeFile(thumbnailPath, webpBuffer);
            console.log(Colorize.bgGreen(`[generateAllThumbnails] Generata thumbnail WebP pagina ${page}/${pageCount}`));
        } catch (error) {
            console.error(Colorize.bgRed(`[generateAllThumbnails] Errore generazione pagina ${page}: ${error.message}`));
        }
    }

    console.log(Colorize.bgGreen(`[generateAllThumbnails] Completata generazione thumbnail per ${materialeId}`));
}

/**
 * Ottiene il percorso della thumbnail cached per una specifica pagina.
 *
 * @param thumbnailsDir - Cartella delle thumbnail
 * @param materialeId - ID del materiale
 * @param page - Numero di pagina
 * @returns Percorso del file se esiste, null altrimenti
 */
function getCachedThumbnailPath(thumbnailsDir: string, materialeId: string, page: number): string | null {
    const thumbnailPath = path.join(thumbnailsDir, `${materialeId}_page${page}.webp`);
    return fs.existsSync(thumbnailPath) ? thumbnailPath : null;
}

function getCachedSvgPath(svgDir: string, materialeId: string, page: number): string {
    return path.join(svgDir, `${materialeId}_page${page}.svg`);
}

async function getMaterialPageCount(materiale: Materiali, pdfPath: string): Promise<number> {
    const pageCountFromDb = Number(materiale.pagine);
    if (Number.isInteger(pageCountFromDb) && pageCountFromDb > 0) {
        return pageCountFromDb;
    }

    return await countPagePdf(pdfPath);
}

async function shouldRegenerateDerivedFile(pdfPath: string, derivedPath: string, force = false): Promise<boolean> {
    if (force) {
        return true;
    }

    if (!fs.existsSync(derivedPath)) {
        return true;
    }

    const [pdfStat, derivedStat] = await Promise.all([
        fs.promises.stat(pdfPath),
        fs.promises.stat(derivedPath),
    ]);

    return derivedStat.mtimeMs < pdfStat.mtimeMs;
}

async function ensureSvgPageCached(params: {
    pdfPath: string;
    svgDir: string;
    materialeId: string;
    page: number;
    force?: boolean;
}): Promise<string> {
    if (!fs.existsSync(params.svgDir)) {
        fs.mkdirSync(params.svgDir, { recursive: true });
    }

    const svgPath = getCachedSvgPath(params.svgDir, params.materialeId, params.page);
    const regenerate = await shouldRegenerateDerivedFile(params.pdfPath, svgPath, params.force);

    if (regenerate) {
        await convertPdfToSvgUsingPostScript({
            pdfPath: params.pdfPath,
            outputPath: svgPath,
            firstPage: params.page,
            lastPage: params.page,
        });
    }

    return svgPath;
}

async function generateAllSvgPages(
    pdfPath: string,
    materialeId: string,
    svgDir: string,
    pageCount: number,
    force = false,
): Promise<{ generated: number; skipped: number; errors: number }> {
    if (!fs.existsSync(svgDir)) {
        fs.mkdirSync(svgDir, { recursive: true });
    }

    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (let page = 1; page <= pageCount; page++) {
        const svgPath = getCachedSvgPath(svgDir, materialeId, page);

        try {
            const regenerate = await shouldRegenerateDerivedFile(pdfPath, svgPath, force);
            if (!regenerate) {
                skipped++;
                continue;
            }

            await convertPdfToSvgUsingPostScript({
                pdfPath,
                outputPath: svgPath,
                firstPage: page,
                lastPage: page,
            });
            generated++;
        } catch (error: any) {
            errors++;
            console.error(Colorize.bgRed(`[generateAllSvgPages] Errore pagina ${page} materiale ${materialeId}: ${error.message}`));
        }
    }

    return { generated, skipped, errors };
}

/**
 * Calcola il dHash (perceptual hash) 64-bit di una thumbnail WebP.
 * Restituisce una stringa hex da 16 caratteri.
 */
async function computeThumbnailDHash(thumbnailPath: string): Promise<string | null> {
    try {
        const { data, info } = await sharp(thumbnailPath)
            .grayscale()
            .resize(33, 32, { fit: 'fill' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        if (info.width !== 33 || info.height !== 32 || info.channels < 1) {
            return null;
        }

        let hash = '';
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x += 4) {
                let nibble = 0;
                for (let bit = 0; bit < 4; bit++) {
                    const xx = x + bit;
                    const left = data[y * 33 + xx];
                    const right = data[y * 33 + xx + 1];
                    nibble = (nibble << 1) | (left > right ? 1 : 0);
                }
                hash += nibble.toString(16);
            }
        }

        return hash;
    } catch (error) {
        console.error(Colorize.bgRed(`[computeThumbnailDHash] Errore hash ${thumbnailPath}: ${error.message}`));
        return null;
    }
}

/**
 * Calcola l'hash percettivo di un PDF usando le thumbnail già presenti.
 * Se manca almeno una thumbnail, restituisce null per forzare il fallback al confronto profondo.
 */
async function hashPdfThumbnails(materialeId: string, thumbnailsDir: string, pageCount: number): Promise<string | null> {
    try {
        const thumbnailPath = path.join(thumbnailsDir, `${materialeId}_page1.webp`);
        if (!fs.existsSync(thumbnailPath)) {
            return null;
        }

        return await computeThumbnailDHash(thumbnailPath);
    } catch (error) {
        console.error(Colorize.bgRed(`[hashPdfThumbnails] Errore pHash thumbnails ${materialeId}: ${error.message}`));
        return null;
    }
}

/**
 * Distanza di Hamming tra due hash hex della stessa lunghezza.
 * Conta i bit differenti.
 */
function hammingDistanceHex(hashA: string, hashB: string): number {
    if (hashA.length !== hashB.length) {
        throw new Error('Hamming distance richiede hash della stessa lunghezza');
    }

    const bitCount = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
    let distance = 0;

    for (let i = 0; i < hashA.length; i++) {
        const a = parseInt(hashA[i], 16);
        const b = parseInt(hashB[i], 16);

        if (Number.isNaN(a) || Number.isNaN(b)) {
            distance += hashA[i] === hashB[i] ? 0 : 1;
            continue;
        }

        distance += bitCount[a ^ b];
    }

    return distance;
}

/**
 * Confronta due PDF in profondità (async): prima confronto testuale (pdftotext),
 * poi confronto visuale pixel per pixel (pdftoppm + ImageMagick compare).
 *
 * Richiede: poppler-utils (pdftotext, pdftoppm) e imagemagick (compare)
 *
 * @param pdf1 - Percorso del primo file PDF
 * @param pdf2 - Percorso del secondo file PDF
 * @returns true se i PDF sono identici (testo + visuale), false altrimenti
 */
async function comparePdfDeepAsync(pdf1: string, pdf2: string): Promise<boolean> {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-eq-'));
    try {
        const t1 = path.join(tmp, 'a.txt');
        const t2 = path.join(tmp, 'b.txt');

        // Fase 1: confronto testuale
        await execAsync(`pdftotext -layout "${pdf1}" "${t1}"`);
        await execAsync(`pdftotext -layout "${pdf2}" "${t2}"`);

        const text1 = await fs.promises.readFile(t1, 'utf8');
        const text2 = await fs.promises.readFile(t2, 'utf8');
        if (text1 !== text2) {
            console.log(`[comparePdfDeepAsync] Testo diverso tra i PDF ${pdf1} e ${pdf2}`);
            return false;
        }

        // Fase 2: rendering pagine in PNG
        await execAsync(`pdftoppm -r 200 "${pdf1}" "${path.join(tmp, 'a')}" -png`);
        await execAsync(`pdftoppm -r 200 "${pdf2}" "${path.join(tmp, 'b')}" -png`);

        const files = await fs.promises.readdir(tmp);
        const pagesA = files.filter(f => /^a-\d+\.png$/.test(f)).sort();
        const pagesB = files.filter(f => /^b-\d+\.png$/.test(f)).sort();

        if (pagesA.length !== pagesB.length) {
            console.log(`[comparePdfDeepAsync] Numero pagine diverso: ${pagesA.length} vs ${pagesB.length}`);
            return false;
        }

        // Fase 3: confronto pixel per pixel con ImageMagick
        for (let i = 0; i < pagesA.length; i++) {
            try {
                await execAsync(
                    `compare -metric AE "${path.join(tmp, pagesA[i])}" "${path.join(tmp, pagesB[i])}" null:`
                );
            } catch (err: any) {
                // ImageMagick compare: exit code 1 = immagini diverse, exit code 2 = errore
                const exitCode = typeof err.code === 'number' ? err.code : -1;
                if (exitCode === 2) {
                    console.error(`[comparePdfDeepAsync] Errore ImageMagick compare: ${err.stderr || err.message}`);
                    throw new Error(`ImageMagick compare error: ${err.stderr || err.message}`);
                }
                console.log(`[comparePdfDeepAsync] Immagini diverse a pagina ${i + 1}`);
                return false;
            }
        }

        return true;
    } catch (error: any) {
        console.error(`[comparePdfDeepAsync] Errore generale: ${error.message}`);
        return false;
    } finally {
        await fs.promises.rm(tmp, { recursive: true, force: true });
    }
}
