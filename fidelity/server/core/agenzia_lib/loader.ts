import config from "../config/index.js";
import type { IUserService } from "../interfaces/IUserService.js";
import { log } from "../logger/index.js";
import type { IAgenziaLib } from "./types.js";

/**
 * Carica l'implementazione AgenziaLib corrispondente al CLIENT_ID nell'env.
 * Se CLIENT_ID non è definito o è "default", usa DefaultAgenziaLib.
 * Altrimenti cerca in `./[clientId]/index.ts`.
 */
export async function loadAgenziaLib(
  userService: IUserService
): Promise<IAgenziaLib> {
  const clientFolder = (config.CLIENT_ID ?? "default").toLowerCase();
  const clientId =
    clientFolder.charAt(0).toUpperCase() + clientFolder.slice(1);

  if (clientFolder === "default") {
    const { DefaultAgenziaLib } = await import("./default/index.js");
    log.info(`[AgenziaLib] Caricato modulo default`);
    return new DefaultAgenziaLib(userService);
  }

  try {
    // Dynamic import del modulo specifico per il cliente
    const mod = await import(`./${clientFolder}/index.js`);
    if (!mod[`${clientId}AgenziaLib`]) {
      throw new Error(
        `Il modulo agenzia_lib/${clientFolder} non esporta "${clientId}AgenziaLib"`
      );
    }
    log.info(`[AgenziaLib] Caricato modulo per client: ${clientId}`);
    return new mod[`${clientId}AgenziaLib`](userService);
  } catch (error) {
    log.warn(
      `[AgenziaLib] Modulo per client "${clientFolder}" non trovato, uso default`,
      { error }
    );
    const { DefaultAgenziaLib } = await import("./default/index.js");
    return new DefaultAgenziaLib(userService);
  }
}
