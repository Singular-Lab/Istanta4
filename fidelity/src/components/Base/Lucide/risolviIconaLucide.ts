import * as LucideIcons from "lucide-react";
import { icons } from "lucide-react";

export type IconaLucide = (typeof icons)[keyof typeof icons];

// Solo i componenti icona: esclude export come Icon, icons, createLucideIcon, LucideProvider
const iconeValide = new Set<unknown>(Object.values(icons));
const nomiGiaSegnalati = new Set<string>();

/**
 * Risolve il nome di un'icona Lucide nel suo componente.
 * In lucide-react 1.x la mappa `icons` non contiene piu' i nomi legacy (Trash2, AlertTriangle,
 * History...), ancora usati come stringa nel codice e nel menu da DB, ma ancora esportati come alias.
 */
export function risolviIconaLucide(nome: string): IconaLucide | undefined {
  const icona =
    (icons as Record<string, unknown>)[nome] ??
    (LucideIcons as Record<string, unknown>)[nome];
  if (iconeValide.has(icona)) return icona as IconaLucide;

  if (import.meta.env?.DEV && nome && !nomiGiaSegnalati.has(nome)) {
    nomiGiaSegnalati.add(nome);
    console.warn(`[Lucide] icona "${nome}" non trovata`);
  }
  return undefined;
}
