import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import SftpClient = require('ssh2-sftp-client');

import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import { Colorize } from '@lib/colorize';
import { FileItemKit, FileTreeAction, FileTreeCondition, FileTreeNode, RootFileTree, RUNTIME_KIT_MONGO } from '@server_types/types';
import { OlimpoService } from 'src/app.service';
import { MaterialiService } from 'src/materiali/materiali.service';
import { Materiali } from 'src/models/materiali.model';
import { WebsocketGateway } from 'src/websocket/websocket.getaway';

// Wrapping some fs functions
const mkdirAsync = promisify(fs.mkdir);


type VirtualDirectory = {
    path: string;
    name: string;
    children?: VirtualDirectory[];
};

export type SftpConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
};

@Injectable()
export class FtpService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FtpService.name);
    // La directory FTP "root"
    private ftpRoot: string = process.env.FTP_ROOT || path.join(process.cwd(), 'uploads', 'FTP');

    private socketServer: any;

    constructor(
        private readonly olimpoService: OlimpoService,
        private readonly materialiService: MaterialiService,
        private readonly websocketGateway: WebsocketGateway
    ) {
    }


    async onModuleInit() {
        // Assicuriamoci che la root esista
        if (!fs.existsSync(this.ftpRoot)) {
            await mkdirAsync(this.ftpRoot, { recursive: true });
        }
        this.logger.log(`FTP root garantita: ${this.ftpRoot}`);
    }

    onModuleDestroy() {
        this.logger.log('FTP Service destroyed');
    }

    /**
     * Normalizza un path remoto SFTP in formato posix.
     */
    private normalizeRemotePath(remotePath: string): string {
        if (!remotePath || remotePath === '.') {
            return '.';
        }

        const normalized = remotePath
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');

        return normalized || '.';
    }

    private joinRemotePath(basePath: string, nextSegment: string): string {
        const normalizedBase = this.normalizeRemotePath(basePath);
        const normalizedSegment = this.normalizeRemotePath(nextSegment);

        if (normalizedSegment === '.') {
            return normalizedBase;
        }

        if (normalizedBase === '.') {
            return normalizedSegment;
        }

        return path.posix.join(normalizedBase, normalizedSegment);
    }

    private async connectSftp(config: SftpConfig): Promise<SftpClient> {
        const client = new SftpClient();
        await client.connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            hostVerifier: () => true,
        });
        return client;
    }

    private async disconnectSftp(client: SftpClient): Promise<void> {
        try {
            await client.end();
        } catch (error) {
            this.logger.warn(`Errore durante la disconnessione SFTP: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async ensureRemoteDir(client: SftpClient, remoteDir: string): Promise<void> {
        const normalizedPath = this.normalizeRemotePath(remoteDir);
        if (normalizedPath === '.') {
            return;
        }

        const exists = await client.exists(normalizedPath);
        if (exists === 'd') {
            return;
        }

        if (exists) {
            throw new Error(`Il path remoto esiste ma non e' una directory: ${normalizedPath}`);
        }

        await client.mkdir(normalizedPath, true);
    }

    private async uploadFile(client: SftpClient, localFilePath: string, remoteFilePath: string): Promise<void> {
        await client.put(localFilePath, remoteFilePath);
    }

    /**
     * pushDir: crea una directory in currentRoot e restituisce il nuovo current root.
     */
    private async pushDir(client: SftpClient, currentRoot: string, dirName: string, level: number): Promise<string> {
        const newRoot = this.joinRemotePath(currentRoot, dirName);
        await this.ensureRemoteDir(client, newRoot);
        this.logger.log(`[L${level}] pushDir: creato o trovato ${newRoot}`);
        return newRoot;
    }

    /**
     * Crea una directory allo stesso livello in currentRoot.
     */
    private async createDir(client: SftpClient, currentRoot: string, dirName: string, level: number): Promise<void> {
        const targetPath = this.joinRemotePath(currentRoot, dirName);
        await this.ensureRemoteDir(client, targetPath);
        this.logger.log(`[L${level}] createDir: creata/trovata directory ${targetPath}`);
    }

    /**
     * Deposita un file in currentRoot/dirName.
     */
    private async depositFile(client: SftpClient, currentRoot: string, dirName: string, localFile: string, newFileName: string, level: number): Promise<void> {
        const targetDir = this.joinRemotePath(currentRoot, dirName);
        await this.ensureRemoteDir(client, targetDir);
        const targetPath = this.joinRemotePath(targetDir, newFileName);
        await this.uploadFile(client, localFile, targetPath);
        this.logger.log(`[L${level}] depositFile: depositato file in ${targetPath}`);
    }

    /**
   * Verifica se un materiale soddisfa tutte le conditions.
   */
    private conditionsMet(conditions: FileTreeCondition[], materiale: Materiali, kit: RUNTIME_KIT_MONGO): boolean {
        const conditionByIncludes = conditions.every((cond) => {
            switch (cond.operator) {
                case '=':
                    return materiale.original_name.includes(cond.value);
                case '!=':
                    return !materiale.original_name.includes(cond.value);
                case 'contains':
                    return materiale.original_name.includes(cond.value);
                case 'not_contains':
                    return !materiale.original_name.includes(cond.value);
                default:
                    return false;
            }
        });
        const conditionByKit = conditions.every((cond) => {
            if (kit.codiceCanale.includes(cond.value)) {
                return true;
            } else if (kit.codiceArea.includes(cond.value)) {
                return true;
            }
            return false;
        });
        this.logger.log(`conditionsMet: ${conditionByIncludes} && ${conditionByKit}`);
        return conditionByIncludes && conditionByKit;
    }
    /**
     * Esegue i comandi definiti in un FileTreeAction, aggiornando il currentRoot
     * se il comando è "mkdir". Restituisce il currentRoot aggiornato.
     */
    private async executeCommands(
        client: SftpClient,
        currentRoot: string,
        action: FileTreeAction,
        fileKit: FileItemKit,
        materiale: Materiali,
        dictionary: { [key: string]: string },
        level: number
    ): Promise<string> {
        let updatedRoot = currentRoot;

        if (!action.commands || action.commands.length === 0) {
            this.logger.warn(`[L${level}] Nessun comando in action: ${JSON.stringify(action)}`);
            return updatedRoot;
        }

        for (const cmd of action.commands) {
            switch (cmd) {
                case 'mkdir': {
                    if (!action.dirname || action.dirname.length === 0) {
                        this.logger.error(`[L${level}] mkdir ma dirname vuoto in action: ${JSON.stringify(action)}`);
                        continue;
                    }
                    // Per ogni directory in dirname, sostituisci eventuali placeholder e aggiorna updatedRoot
                    for (let d of action.dirname) {
                        for (const key in dictionary) {
                            if (dictionary.hasOwnProperty(key)) {
                                d = d.replace(new RegExp(`\\b${key}\\b`, 'g'), dictionary[key]);
                            }
                        }
                        updatedRoot = await this.pushDir(client, updatedRoot, d, level);
                    }
                    break;
                }
                case 'deposit': {
                    const pathBaseMateriali = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
                    const filePathMateriale = path.join(pathBaseMateriali.path, materiale.file_name);

                    if (action.dirname && action.dirname.length > 0) {
                        // Deposit in updatedRoot: se abbiamo creato directory con mkdir, deposita in quella directory
                        for (let d of action.dirname) {
                            for (const key in dictionary) {
                                if (dictionary.hasOwnProperty(key)) {
                                    d = d.replace(new RegExp(`\\b${key}\\b`, 'g'), dictionary[key]);
                                }
                            }
                            // Assicuriamoci che la directory esista (anche se dovrebbe essere già stata creata)
                            await this.createDir(client, updatedRoot, d, level);
                            await this.depositFile(client, updatedRoot, d, filePathMateriale, materiale.original_name, level);
                        }
                    } else {
                        // Se non ci sono dirname, deposita direttamente in updatedRoot
                        await this.ensureRemoteDir(client, updatedRoot);
                        const targetPath = this.joinRemotePath(updatedRoot, materiale.original_name);
                        await this.uploadFile(client, filePathMateriale, targetPath);
                        this.logger.log(`[L${level}] depositFile: depositato file in ${targetPath}`);
                    }
                    break;
                }
                case 'log': {
                    this.logger.log(Colorize.white(`[L${level}] LOG: file=${fileKit.nome} message=${action.meta.description}`));
                    break;
                }
                case 'notify': {
                    this.logger.warn(`[L${level}] NOTIFY: file=${fileKit.nome} message=${action.log}`);
                    break;
                }
                case 'rollback': {
                    this.logger.fatal(`[L${level}] ROLLBACK: file=${fileKit.nome}`);
                    break;
                }
                case 'warn': {
                    this.logger.warn(`[L${level}] WARN command su file=${fileKit.nome}`);
                    break;
                }
                default: {
                    this.logger.warn(`[L${level}] Comando sconosciuto: ${cmd}`);
                    break;
                }
            }
        }
        return updatedRoot;
    }

    /**
     * Processa un singolo nodo: se le condizioni sono soddisfatte, esegue on_respect_condition;
     * altrimenti esegue on_error. Se il nodo ha un filetree, processa il primo nodo figlio che soddisfa.
     * Il currentRoot viene aggiornato se esiste un comando mkdir, e alla fine torna al currentRoot passato.
     */
    private async processNode(
        client: SftpClient,
        node: FileTreeNode,
        currentRoot: string,
        fileKit: FileItemKit,
        materiale: Materiali,
        dictionary: { [key: string]: string },
        level: number,
        kit: RUNTIME_KIT_MONGO
    ): Promise<void> {
        this.logger.log(`[L${level}] processNode: priority=${node.priority}`);
        let newRoot = currentRoot;
        if (this.conditionsMet(node.conditions, materiale, kit)) {
            this.logger.log(`[L${level}] Condizioni soddisfatte per priority=${node.priority}`);
            // Esegui on_respect_condition, aggiornando il currentRoot se necessario
            newRoot = await this.executeCommands(client, currentRoot, node.on_respect_condition, fileKit, materiale, dictionary, level + 1);
            // Se esistono sotto-nodi, processali usando il nuovo currentRoot
            if (node.filetree && node.filetree.length > 0) {
                await this.processTree(client, node.filetree, newRoot, fileKit, materiale, dictionary, level + 1, kit);
            }
        } else {
            this.logger.warn(`[L${level}] Condizioni NON soddisfatte per priority=${node.priority}`);
            // Esegui on_error e fallback (senza aggiornare il currentRoot)
            await this.executeCommands(client, currentRoot, node.on_error, fileKit, materiale, dictionary, level + 1);
            if (node.fallback && node.fallback.action === 'mkdir' && node.fallback.dirname && node.fallback.dirname.length > 0) {
                for (let d of node.fallback.dirname) {
                    for (const key in dictionary) {
                        if (dictionary.hasOwnProperty(key)) {
                            d = d.replace(key, dictionary[key]);
                        }
                    }
                    await this.createDir(client, currentRoot, d, level + 1);
                }
            }
        }
    }

    /**
     * Processa l'albero dei nodi (filetree) cercando di selezionare il primo nodo (in ordine di priority asc)
     * che soddisfa le condizioni. Se lo trova, lo processa; altrimenti esegue on_error/fallback di tutti i nodi.
     * Il parametro 'currentRoot' rappresenta la directory corrente (che viene aggiornata se un nodo ha mkdir).
     */
    private async processTree(
        client: SftpClient,
        nodes: FileTreeNode[],
        currentRoot: string,
        fileKit: FileItemKit,
        materiale: Materiali,
        dictionary: { [key: string]: string },
        level: number,
        kit: RUNTIME_KIT_MONGO,
        socketId?: string
    ): Promise<void> {
        this.logger.log(`[L${level}] processTree con ${nodes.length} nodi, currentRoot=${currentRoot}`);
        const sortedNodes = [...nodes].sort((a, b) => a.priority - b.priority);
        let found = false;
        for (const node of sortedNodes) {
            if (this.conditionsMet(node.conditions, materiale, kit)) {
                this.logger.log(`[L${level}] Trovato nodo con priority=${node.priority} che soddisfa, processando...`);
                await this.processNode(client, node, currentRoot, fileKit, materiale, dictionary, level + 1, kit);
                found = true;
                break;
            }
        }
        if (!found) {
            this.logger.warn(`[L${level}] Nessun nodo soddisfa le condizioni, eseguo on_error/fallback per tutti i nodi`);
            for (const node of sortedNodes) {
                await this.executeCommands(client, currentRoot, node.on_error, fileKit, materiale, dictionary, level + 1);
                if (node.fallback && node.fallback.action === 'mkdir' && node.fallback.dirname) {
                    for (let d of node.fallback.dirname) {
                        for (const key in dictionary) {
                            if (dictionary.hasOwnProperty(key)) {
                                d = d.replace(key, dictionary[key]);
                            }
                        }
                        await this.createDir(client, currentRoot, d, level + 1);
                    }
                }
            }
        }
    }

    /**
     * Metodo principale: crea cartelle e deposita file basandosi sullo schema RootFileTree.
     * Per ogni file, viene processato l'albero dei nodi, partendo dalla root del contratto,
     * e al termine di ogni file si torna alla root contrattuale.
     */
    async creaPathFromContrattoTipografia(
        contratto: RootFileTree,
        kit: RUNTIME_KIT_MONGO,
        socketId: string | undefined,
        sftpConfig: SftpConfig
    ): Promise<void> {
        let sftpClient: SftpClient | null = null;
        try {
            sftpClient = await this.connectSftp(sftpConfig);
            const contractRoot = this.normalizeRemotePath(contratto.root);
            this.logger.log(`Connessione SFTP attiva: uso contratto.root = ${contractRoot}`);
            await this.ensureRemoteDir(sftpClient, contractRoot);

            if (socketId) {
                this.websocketGateway.server.emit(`${socketId}_progress`, {
                    step: 'root_created',
                    message: `Root remota SFTP creata: ${contractRoot}`
                });
            }

            if (kit.files != undefined && kit.files.length > 0) {
                const totalFiles = kit.files.length;
                if (socketId) {
                    this.websocketGateway.server.emit(`${socketId}_info`, {
                        totalFiles,
                        kitName: kit.titolo
                    });
                }

                // Raccogli gli ID dei file che fanno parte di un merged group (non vanno copiati individualmente)
                const mergedFileIds = new Set<string>();
                for (const f of kit.files) {
                    if (f.is_merged_group && f.merged_file_ids) {
                        for (const id of f.merged_file_ids) {
                            mergedFileIds.add(id);
                        }
                    }
                }

                for (let i = 0; i < kit.files.length; i++) {
                    const fileKit = kit.files[i];
                    if (socketId) {
                        this.websocketGateway.server.emit(`${socketId}_progress`, {
                            file: i + 1,
                            totalFiles,
                            fileName: fileKit.nome,
                            progress: i / totalFiles,
                            message: `Elaborazione file ${i + 1}/${totalFiles}: ${fileKit.nome}`
                        });
                    }

                    // Merged group: deposita solo nella virtual_dir
                    if (fileKit.is_merged_group && fileKit.virtual_dir) {
                        if (fileKit.id_olimpo_cloud === undefined) continue;
                        const materiale = await this.materialiService.getMaterialeFromId(fileKit.id_olimpo_cloud);
                        if (!materiale) continue;
                        const targetDir = this.normalizeRemotePath(String(fileKit.virtual_dir));
                        await this.ensureRemoteDir(sftpClient, targetDir);
                        const pathBaseMateriali = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.MATERIALI);
                        const filePathMateriale = path.join(pathBaseMateriali.path, materiale.file_name);
                        const targetPath = this.joinRemotePath(targetDir, fileKit.nome);
                        await this.uploadFile(sftpClient, filePathMateriale, targetPath);
                        this.logger.log(`Merged group depositato in virtual_dir: ${targetPath}`);
                        continue;
                    }

                    // Skip: file che fanno parte di un merged group
                    if (mergedFileIds.has(fileKit.id)) {
                        this.logger.log(`File ${fileKit.nome} saltato: fa parte di un merged group`);
                        continue;
                    }

                    if (fileKit.id_olimpo_cloud === undefined) {
                        if (socketId) {
                            this.websocketGateway.server.emit(`${socketId}_error`, {
                                file: fileKit.nome,
                                error: 'id_olimpo_cloud non definito'
                            });
                        }
                        this.logger.error(`id_olimpo_cloud non definito per file: ${fileKit.nome} e kit: ${kit.titolo}`);
                        continue;
                    }

                    const materiale = await this.materialiService.getMaterialeFromId(fileKit.id_olimpo_cloud);
                    if (!materiale) {
                        this.logger.warn(`Materiale non trovato per file: ${fileKit.nome} e kit: ${kit.titolo}`);
                        if (socketId) {
                            this.websocketGateway.server.emit(`${socketId}_warning`, {
                                file: fileKit.nome,
                                warning: 'Materiale non trovato'
                            });
                        }
                        continue;
                    }

                    this.logger.log(`\n----- Inizio processTree per file: ${fileKit.nome} dentro il kit ${kit.titolo} -----\n`);

                    await this.processTree(
                        sftpClient,
                        contratto.root_file_tree,
                        contractRoot,
                        fileKit,
                        materiale,
                        contratto.dictionary || {},
                        1,
                        kit,
                        socketId
                    );
                    this.logger.log(`\n----- Fine processTree per file: ${fileKit.nome} -----\n`);
                }
            }
        } catch (error) {
            if (socketId) {
                this.websocketGateway.server.emit(`${socketId}_error`, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            this.logger.error('Errore durante la creazione delle cartelle con logica tipografia', error);
            throw error;
        } finally {
            if (sftpClient) {
                await this.disconnectSftp(sftpClient);
            }
        }
    }

    async getVirtualDirectories(kits: RUNTIME_KIT_MONGO[]): Promise<VirtualDirectory[]> {
        const collectedPaths = new Set<string>();

        const executeCommandsVirtual = (
            currentRoot: string,
            action: FileTreeAction,
            dictionary: { [key: string]: string },
            level: number
        ): string => {
            let updatedRoot = currentRoot;
            if (!action.commands || action.commands.length === 0) return updatedRoot;

            for (const cmd of action.commands) {
                switch (cmd) {
                    case 'mkdir': {
                        if (!action.dirname || action.dirname.length === 0) continue;
                        for (let d of action.dirname) {
                            for (const key in dictionary) {
                                if (dictionary.hasOwnProperty(key)) {
                                    d = d.replace(new RegExp(`\\b${key}\\b`, 'g'), dictionary[key]);
                                }
                            }
                            updatedRoot = path.join(updatedRoot, d);
                            collectedPaths.add(updatedRoot);
                        }
                        break;
                    }
                    case 'deposit': {
                        if (action.dirname && action.dirname.length > 0) {
                            for (let d of action.dirname) {
                                for (const key in dictionary) {
                                    if (dictionary.hasOwnProperty(key)) {
                                        d = d.replace(new RegExp(`\\b${key}\\b`, 'g'), dictionary[key]);
                                    }
                                }
                                collectedPaths.add(path.join(updatedRoot, d));
                            }
                        }
                        break;
                    }
                }
            }
            return updatedRoot;
        };

        const processNodeVirtual = (
            node: FileTreeNode,
            currentRoot: string,
            fileKit: FileItemKit,
            materiale: Materiali,
            dictionary: { [key: string]: string },
            level: number,
            kit: RUNTIME_KIT_MONGO
        ): void => {
            let newRoot = currentRoot;
            if (this.conditionsMet(node.conditions, materiale, kit)) {
                newRoot = executeCommandsVirtual(currentRoot, node.on_respect_condition, dictionary, level + 1);
                if (node.filetree && node.filetree.length > 0) {
                    processTreeVirtual(node.filetree, newRoot, fileKit, materiale, dictionary, level + 1, kit);
                }
            } else {
                executeCommandsVirtual(currentRoot, node.on_error, dictionary, level + 1);
                if (node.fallback && node.fallback.action === 'mkdir' && node.fallback.dirname && node.fallback.dirname.length > 0) {
                    for (let d of node.fallback.dirname) {
                        for (const key in dictionary) {
                            if (dictionary.hasOwnProperty(key)) {
                                d = d.replace(key, dictionary[key]);
                            }
                        }
                        collectedPaths.add(path.join(currentRoot, d));
                    }
                }
            }
        };

        const processTreeVirtual = (
            nodes: FileTreeNode[],
            currentRoot: string,
            fileKit: FileItemKit,
            materiale: Materiali,
            dictionary: { [key: string]: string },
            level: number,
            kit: RUNTIME_KIT_MONGO
        ): void => {
            const sortedNodes = [...nodes].sort((a, b) => a.priority - b.priority);
            let found = false;
            for (const node of sortedNodes) {
                if (this.conditionsMet(node.conditions, materiale, kit)) {
                    processNodeVirtual(node, currentRoot, fileKit, materiale, dictionary, level + 1, kit);
                    found = true;
                    break;
                }
            }
            if (!found) {
                for (const node of sortedNodes) {
                    executeCommandsVirtual(currentRoot, node.on_error, dictionary, level + 1);
                    if (node.fallback && node.fallback.action === 'mkdir' && node.fallback.dirname) {
                        for (let d of node.fallback.dirname) {
                            for (const key in dictionary) {
                                if (dictionary.hasOwnProperty(key)) {
                                    d = d.replace(key, dictionary[key]);
                                }
                            }
                            collectedPaths.add(path.join(currentRoot, d));
                        }
                    }
                }
            }
        };

        let contractRoot = '';
        for (const kit of kits) {
            const contratto = kit.contrattoElaborato;
            if (!contratto) continue;
            contractRoot = contratto.root;

            if (kit.files && kit.files.length > 0) {
                // Raccogli gli ID dei file che fanno parte di un merged group
                const mergedFileIds = new Set<string>();
                for (const f of kit.files) {
                    if (f.is_merged_group && f.merged_file_ids) {
                        for (const id of f.merged_file_ids) {
                            mergedFileIds.add(id);
                        }
                    }
                }

                for (const fileKit of kit.files) {
                    // Merged group: aggiungi solo la virtual_dir ai path
                    if (fileKit.is_merged_group && fileKit.virtual_dir) {
                        collectedPaths.add(fileKit.virtual_dir);
                        continue;
                    }

                    // Skip: file che fanno parte di un merged group
                    if (mergedFileIds.has(fileKit.id)) continue;

                    if (fileKit.id_olimpo_cloud === undefined) continue;
                    const materiale = await this.materialiService.getMaterialeFromId(fileKit.id_olimpo_cloud);
                    if (!materiale) continue;
                    processTreeVirtual(contratto.root_file_tree, contractRoot, fileKit, materiale, contratto.dictionary || {}, 1, kit);
                }
            }
        }

        return this.buildVirtualTree(contractRoot, collectedPaths);
    }

    private buildVirtualTree(rootPath: string, paths: Set<string>): VirtualDirectory[] {
        const result: VirtualDirectory[] = [];
        const sortedPaths = [...paths].sort();

        for (const fullPath of sortedPaths) {
            const relativePath = path.relative(rootPath, fullPath);
            const parts = relativePath.split(path.sep);
            let currentLevel = result;
            let currentPath = rootPath;

            for (const part of parts) {
                currentPath = path.join(currentPath, part);
                let existing = currentLevel.find(d => d.path === currentPath);
                if (!existing) {
                    existing = { path: currentPath, name: part, children: [] };
                    currentLevel.push(existing);
                }
                currentLevel = existing.children;
            }
        }

        return result;
    }
}
