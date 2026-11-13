import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { migraAllAvvio, type Collegamento } from './migrazioni';

/**
 * Le migrazioni sulla connessione Sequelize di Olimpo: ogni query nella stessa transazione, con i
 * parametri come bind ($1, $2...). Una query senza parametri puo' contenere piu' istruzioni.
 */
export const collegamentoSequelize = (sequelize: Sequelize): Collegamento => ({
  inTransazione: (lavoro) =>
    sequelize.transaction((transaction) =>
      lavoro({
        query: async <T>(sql: string, parametri?: unknown[]) => {
          const [righe] = await sequelize.query(sql, {
            transaction,
            ...(parametri ? { bind: parametri } : {}),
          });
          return righe as T[];
        },
      })
    ),
});

/**
 * Applica le migrazioni del database all'avvio (vedi migrazioni.ts). onModuleInit gira dopo
 * `synchronize` di Sequelize e prima che Olimpo accetti richieste: un errore ferma l'avvio.
 */
@Injectable()
export class MigrazioniService implements OnModuleInit {
  private readonly logger = new Logger(MigrazioniService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) { }

  async onModuleInit(): Promise<void> {
    try {
      await migraAllAvvio(collegamentoSequelize(this.sequelize), this.logger);
    } catch (errore) {
      this.logger.error(`Avvio fermato: ${(errore as Error).message}`);
      throw errore;
    }
  }
}
