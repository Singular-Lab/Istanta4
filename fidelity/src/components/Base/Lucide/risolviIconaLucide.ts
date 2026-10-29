import type { LucideIcon } from "lucide-react";
import * as iconeUsate from "./iconeUsate";

export type IconaLucide = LucideIcon;

interface MappaCompleta {
  /** Tutti gli export di lucide-react, compresi gli alias legacy (Trash2, AlertTriangle...). */
  esportazioni: Record<string, unknown>;
  /** Solo i componenti icona: esclude export come Icon, icons, createLucideIcon, LucideProvider. */
  icone: Set<unknown>;
}

// Icone nominate come stringa nel codice (file generato da scripts/generaIconeLucide.mjs): sono
// tutte componenti icona e si risolvono subito, senza caricare la mappa completa.
const iconeNote: Record<string, unknown> = iconeUsate;

// Solo proprietà proprie: nel bundle l'oggetto modulo può ereditare da Object.prototype, e un nome
// come "toString" non deve diventare un'icona. (Object.hasOwn manca nei vecchi Safari.)
function proprieta(oggetto: Record<string, unknown>, nome: string): unknown {
  return Object.prototype.hasOwnProperty.call(oggetto, nome) ? oggetto[nome] : undefined;
}

let mappaCompleta: MappaCompleta | null = null;
let caricamento: Promise<void> | null = null;
const nomiGiaSegnalati = new Set<string>();

/**
 * Risolve il nome di un'icona Lucide nel suo componente.
 * Prima cerca fra le icone usate nel codice; per gli altri nomi (es. il menu letto dal DB) serve la
 * mappa completa di lucide-react, che si carica a parte con {@link caricaMappaCompleta}: finché
 * non è caricata il nome resta irrisolto. In lucide-react 1.x la mappa `icons` non contiene più i
 * nomi legacy (Trash2, AlertTriangle, History...), che restano esportati come alias.
 */
export function risolviIconaLucide(nome: string): IconaLucide | undefined {
  const nota = proprieta(iconeNote, nome);
  if (nota) return nota as IconaLucide;
  if (!mappaCompleta) return undefined;

  const icona = proprieta(mappaCompleta.esportazioni, nome);
  if (mappaCompleta.icone.has(icona)) return icona as IconaLucide;

  if (import.meta.env?.DEV && nome && !nomiGiaSegnalati.has(nome)) {
    nomiGiaSegnalati.add(nome);
    console.warn(`[Lucide] icona "${nome}" non trovata`);
  }
  return undefined;
}

/** Vero quando la mappa completa è caricata: da lì in poi un nome irrisolto non esiste. */
export function mappaCompletaCaricata(): boolean {
  return mappaCompleta !== null;
}

/**
 * Carica (una volta sola) la mappa completa delle icone, in un chunk a parte.
 * Se il caricamento fallisce (es. rete) si potrà ritentare alla richiesta successiva.
 */
export function caricaMappaCompleta(): Promise<void> {
  caricamento ??= import("lucide-react").then(
    (modulo) => {
      mappaCompleta = {
        esportazioni: modulo as unknown as Record<string, unknown>,
        icone: new Set<unknown>(Object.values(modulo.icons)),
      };
    },
    (errore: unknown) => {
      caricamento = null;
      throw errore;
    }
  );
  return caricamento;
}
