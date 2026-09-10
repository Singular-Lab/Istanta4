import CleanCSS from 'clean-css';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { Colorize } from '../../../lib/Colorize';
import { Config, Dashboard, NOMI_MONGODB } from '../../../lib/types';
import config from '../config';
import { log } from '../logger';

export class MongoDBConnector {
    private static instance: MongoDBConnector;
    private _connection: mongoose.Connection | null = null;
    private _connectionPromise: Promise<mongoose.Connection> | null = null;

    private constructor() { }

    public static getInstance(): MongoDBConnector {
        if (!MongoDBConnector.instance) {
            MongoDBConnector.instance = new MongoDBConnector();
        }
        return MongoDBConnector.instance;
    }

    public async connect(): Promise<mongoose.Connection> {
        // If already connected, return the connection
        if (this._connection) return this._connection;

        // If connection is in progress, return the promise
        if (this._connectionPromise) return this._connectionPromise;

        const mongoURI = config.MONGO_URL;
        if (!mongoURI) {
            throw new Error('MONGO_URL environment variable is not defined');
        }

        // Create connection and store it
        this._connection = mongoose.createConnection(mongoURI, {
            dbName: config.MONGO_DB_NAME,
            zlibCompressionLevel: 1,
            autoIndex: false,
            autoCreate: false
        });

        // Setup event listeners
        this.setupEventListeners();

        // Ensure collections exist

        // Store the connection promise
        this._connectionPromise = Promise.resolve(this._connection);

        return this._connection;
    }

    private setupEventListeners(): void {
        if (!this._connection) return;

        this._connection.on('connected', async () => {
            log.info(Colorize.bgBlue('Connected to MongoDB:', this._connection?.name));
            await this.ensureCollections();
        });

        this._connection.on('error', (err) => {
            log.error('Connessione MongoDB persa o errore di rete', err instanceof Error ? err : null, {
                dbName: config.MONGO_DB_NAME,
            });
        });
    }

    private async ensureCollections(): Promise<void> {
        try {
            if (!this._connection || !this._connection.db) {
                log.error('ensureCollections: connessione MongoDB non disponibile, impossibile inizializzare le collection');
                return;
            }

            const collections = Object.values(NOMI_MONGODB);
            for (const collection of collections) {
                /*
                    qui ci vanno dei controlli per fare in modo che quando la prima volta viene inizializzato
                    il database, dentro alla tabella config ci finisca il valore di default corretto per almeno
                    i data_fields_refs.
                */
                if (collection === NOMI_MONGODB.config) {
                    const config = await this._connection.db.collection(collection).findOne({});
                    const pathPerStileVergine = path.join(process.cwd(), "on_start", "stile_vergine.json");
                    const pathStileCSS = path.join(process.cwd(), "on_start", "css_vergine.css");
                    const stileCSS = readFileSync(pathStileCSS, 'utf8');
                    const stileCSSMinified = new CleanCSS().minify(stileCSS).styles;
                    const stileVergine = JSON.parse(readFileSync(pathPerStileVergine, 'utf8'));
                    if (!config) {
                        const defaultConfig: Config = {
                            webpliant: {
                                css_text: stileCSSMinified,
                                color_gdo: '',
                                guidId: '',
                                icona_pagina: '',
                                logo_header: [],
                                stili: [stileVergine],
                                stili_minimal: undefined,
                                data_fields_files: [],
                                data_fields_refs: [
                                    {
                                        expected_input: "Descrizioni.Descrizione1",
                                        expected_output: "descrizione_uno",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Descrizioni.Descrizione2",
                                        expected_output: "descrizione_due",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Descrizioni.Descrizione3",
                                        expected_output: "descrizione_tre",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Context.Promo",
                                        expected_output: "context_promo",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Context.Tracciato",
                                        expected_output: "context_tracciato",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Referenza.Codice",
                                        expected_output: "codice_referenza",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Referenza.Ean",
                                        expected_output: "ean_referenza",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Descrizioni.Peso",
                                        expected_output: "descrizione_peso",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Descrizioni.Um",
                                        expected_output: "descrizione_unita_misura",
                                        core: true,
                                    },
                                    {
                                        expected_input: "Descrizioni.Descrizione4",
                                        expected_output: "descrizione_quattro",
                                        core: true,
                                    },
                                    {
                                        expected_input: "prezzo_promo_kgl",
                                        expected_output: "prezzo_promo_kgl",
                                        core: true,
                                    },
                                    {
                                        expected_input: "prezzo_continuo",
                                        expected_output: "prezzo_continuo",
                                        core: true,
                                    }

                                ],
                                meta_volantino: {
                                    title: '',
                                    description: ''
                                },
                            },
                            color: '',
                            dashboard: {} as Dashboard // Imposta un oggetto vuoto come fallback per evitare undefined
                        }
                        await this._connection.db.collection(collection).insertOne(defaultConfig);
                        log.info(Colorize.bgGreen(`Collection ${collection} created`));
                    }
                }
                const collectionExists = await this._connection.db.listCollections({ name: collection }).hasNext();
                if (!collectionExists) {
                    await this._connection.db.createCollection(collection);
                    log.info(Colorize.bgGreen(`Collection ${collection} created`));
                } else {
                    log.info(Colorize.bgGreen(`Collection ${collection} already exists`));
                }
            }
        } catch (error) {
            log.error('Errore durante l\'inizializzazione delle collection MongoDB', error instanceof Error ? error : null);
        }
    }

    public get db(): mongoose.Connection['db'] | undefined {
        return this._connection?.db;
    }

    public get connection(): mongoose.Connection | null {
        return this._connection;
    }

    public async model<T>(name: string, schema: mongoose.Schema, collection?: string): Promise<mongoose.Model<T>> {
        // Wait for connection to be established before creating model
        const conn = await this.connect();
        return conn.model(name, schema, collection) as unknown as mongoose.Model<T>;
    }

    public async disconnect(): Promise<void> {
        if (this._connection) {
            await this._connection.close();
            this._connection = null;
            this._connectionPromise = null;
        }
    }
}

export const MongoDBConnection = MongoDBConnector.getInstance();
