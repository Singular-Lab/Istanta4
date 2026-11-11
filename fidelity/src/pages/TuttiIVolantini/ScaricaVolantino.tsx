import Button from "@/components/Base/Button";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";
import type { FileConsultazione } from "../../../lib/consultazione/tipi";

/** Senza il permesso di scaricare il comando resta, disattivato, e dice cosa manca (spec dati-consultazione). */
export const SERVE_IL_PERMESSO = "Per scaricare serve il permesso di scaricare volantini e POP";
export const NESSUN_FILE = "Il volantino non ha file pubblicati";

const ePdf = (file: FileConsultazione): boolean => (file.mime ?? "").toLowerCase().includes("pdf") || file.nome.toLowerCase().endsWith(".pdf");

/**
 * I file nell'ordine del menu: prima il PDF dell'export volantino, poi gli altri file dell'export
 * volantino, poi gli altri PDF, poi il resto; a parità, per nome.
 */
export const fileInOrdine = (file: readonly FileConsultazione[]): FileConsultazione[] => {
  const peso = (voce: FileConsultazione) => (voce.tipoExport === EXPORT_DI_SISTEMA.VOL ? 0 : 2) + (ePdf(voce) ? 0 : 1);
  return [...file].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "it"));
};

export interface ScaricaVolantinoProps {
  /** L'utente ha il permesso di scaricare volantini e POP (materiali.scarica). */
  puoScaricare: boolean;
  /** I file pubblicati del volantino; undefined mentre arrivano. */
  file: readonly FileConsultazione[] | undefined;
  caricamento: boolean;
  /** Il motivo per cui i file non sono arrivati; null se sono arrivati. */
  errore: string | null;
  /** Il file in download, se c'è. */
  inCorso: string | null;
  onScarica: (idFile: string, nome: string) => void;
}

/**
 * "Scarica il volantino", in alto nel dettaglio del volantino accanto al titolo (spec
 * dati-consultazione, "Download dei file pubblicati dalla Visualizzazione"). Con un solo file pubblicato
 * lo scarica; con più file apre l'elenco, il PDF del volantino per primo. Senza permesso, mentre i
 * file arrivano, se non arrivano o se non ce ne sono resta disattivato e dice perché.
 */
export function ScaricaVolantino({ puoScaricare, file, caricamento, errore, inCorso, onScarica }: ScaricaVolantinoProps) {
  const elenco = fileInOrdine(file ?? []);
  const motivo = !puoScaricare ? SERVE_IL_PERMESSO : errore ? errore : !caricamento && elenco.length === 0 ? NESSUN_FILE : null;
  const icona = <Lucide icon="Download" aria-hidden="true" className="mr-2 h-4 w-4" />;

  if (motivo || caricamento || elenco.length === 1) {
    const unico = elenco.length === 1 ? elenco[0] : null;
    return (
      <Button
        type="button"
        variant="outline-secondary"
        disabled={Boolean(motivo) || caricamento || Boolean(inCorso)}
        loading={caricamento || (unico !== null && inCorso === unico.id)}
        title={motivo ?? (unico ? `Scarica ${unico.nome}` : undefined)}
        onClick={() => unico && onScarica(unico.id, unico.nome)}
      >
        {!caricamento && !(unico && inCorso === unico.id) && icona}
        Scarica il volantino
      </Button>
    );
  }

  return (
    <Menu className="inline-block text-left">
      <Menu.Button as={Button} type="button" variant="outline-secondary" disabled={Boolean(inCorso)}>
        {icona}
        Scarica il volantino
        <Lucide icon="ChevronDown" aria-hidden="true" className="ml-1.5 h-4 w-4" />
      </Menu.Button>
      <Menu.Items className="w-72 max-w-[80vw]">
        {elenco.map(voce => (
          <Menu.Item key={voce.id} onClick={() => onScarica(voce.id, voce.nome)}>
            <Lucide icon={ePdf(voce) ? "FileText" : "File"} aria-hidden="true" className="mr-2 h-4 w-4 flex-none text-slate-500" />
            <span className="min-w-0 truncate" title={voce.nome}>
              {voce.nome}
            </span>
          </Menu.Item>
        ))}
      </Menu.Items>
    </Menu>
  );
}

export default ScaricaVolantino;
