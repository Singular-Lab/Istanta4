import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormCheck } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { formatDataOra, valoreOAssente } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useLocation, useParams } from "react-router-dom";
import { STATO_PROMO, TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { DESIGN_KIT, RUNTIME_KIT, TipiDiExportAttributes } from "../../../../lib/types";
import { PromoResponseDTO } from "../../../../server/core/dto";
type Lavorazione = (DESIGN_KIT & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[] }) | (RUNTIME_KIT & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[], numero_files: number, numero_referenze: number });

type TipoFiltro = 'TUTTI' | 'MANUALI' | 'AUTOMATICI';

// Numero di colonne della tabella, per la riga dello stato vuoto
const COLONNE = 8;

interface LoaderData {
  datiLavorazione: PromoResponseDTO | null;
  lavorazioniManuali: Lavorazione[] | null;
}
function DettagliKitManualiInCorso() {

  const { lavorazioniManuali, datiLavorazione } = useLoaderData() as LoaderData;
  const { idPromo } = useParams();
  // La pagina serve sia le promo in corso sia lo storico: si torna al dettaglio della stessa sezione
  const sezione = useLocation().pathname.startsWith("/promozioni/storico") ? "storico" : "in-corso";
  // Promo in uno stato finale (attiva o archiviata): i kit non si modificano più
  const promoChiusa = [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA].includes(datiLavorazione?.stato as STATO_PROMO);

  const [lavorazioni, setLavorazioni] = useState<Lavorazione[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoAttivo, setTipoAttivo] = useState<TipoFiltro>('TUTTI');
  const [selectedLavorazioni, setSelectedLavorazioni] = useState<string[]>([]);

  useEffect(() => {
    if (lavorazioniManuali) {
      setLavorazioni(lavorazioniManuali);
    } else {
      setLavorazioni([]);
    }
  }, [lavorazioniManuali]);

  // Filtra lavorazioni in base alla ricerca
  const lavorazioniFiltrate = useMemo(() => {
    let risultati = lavorazioni;

    // Seleziona lavorazioni in base al tipo attivo
    if (tipoAttivo === 'MANUALI') {
      risultati = lavorazioni.filter(l => l.tipo === TIPO_KIT_DESIGN.MANUALE);
    } else if (tipoAttivo === 'AUTOMATICI') {
      risultati = lavorazioni.filter(l => l.tipo === TIPO_KIT_DESIGN.AUTOMATICO);
    }

    // Filtra per testo di ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      risultati = risultati.filter(lavorazione =>
        lavorazione.titolo?.toLowerCase().includes(query) ||
        lavorazione.nomeCanale?.toLowerCase().includes(query) ||
        lavorazione.nomeArea?.toLowerCase().includes(query)
      );
    }

    return risultati;
  }, [lavorazioni, searchQuery, tipoAttivo]);

  // Count lavorazioni by type
  const lavorazioniCounts = useMemo(() => {
    return {
      total: lavorazioni.length,
      manuali: lavorazioni.filter(l => l.tipo === TIPO_KIT_DESIGN.MANUALE).length,
      automatici: lavorazioni.filter(l => l.tipo === TIPO_KIT_DESIGN.AUTOMATICO).length
    };
  }, [lavorazioni]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLavorazioni(lavorazioniFiltrate.map(l => l.guidId));
    } else {
      setSelectedLavorazioni([]);
    }
  };

  const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, guidId: string) => {
    if (e.target.checked) {
      setSelectedLavorazioni(prev => [...prev, guidId]);
    } else {
      setSelectedLavorazioni(prev => prev.filter(id => id !== guidId));
    }
  };
  return (
    <Pagina
      titolo={valoreOAssente(datiLavorazione?.nome)}
      descrizione="Gestione lavorazioni manuali e automatiche"
      indietro={{ to: `/promozioni/${sezione}/dettagli/${idPromo ?? datiLavorazione?.id}`, etichetta: "Torna alla promozione" }}
    >
      <Sezione
        senzaPadding
        titolo="Kit della promozione"
        descrizione={`${lavorazioniFiltrate.length} ${lavorazioniFiltrate.length === 1 ? "risultato" : "risultati"}`}
      >
        <BarraFiltri
          destra={
            <Segmenti<TipoFiltro>
              etichetta="Tipo di kit"
              valore={tipoAttivo}
              onChange={setTipoAttivo}
              opzioni={[
                { valore: "TUTTI", etichetta: "Tutti", conteggio: lavorazioniCounts.total },
                { valore: "MANUALI", etichetta: "Manuali", conteggio: lavorazioniCounts.manuali },
                { valore: "AUTOMATICI", etichetta: "Automatici", conteggio: lavorazioniCounts.automatici },
              ]}
            />
          }
        >
          <CampoRicerca
            etichetta="Cerca lavorazioni"
            placeholder="Cerca per titolo, canale, area…"
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </BarraFiltri>

        <div className="overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="w-5">
                  <FormCheck.Input type="checkbox" aria-label="Seleziona tutte le lavorazioni" onChange={handleSelectAll} checked={selectedLavorazioni.length === lavorazioniFiltrate.length && lavorazioniFiltrate.length > 0} />
                </Table.Th>
                <Table.Th>Lavorazione</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Stato</Table.Th>
                <Table.Th>Ultima modifica</Table.Th>
                <Table.Th className="text-right">N. files</Table.Th>
                <Table.Th className="text-right">N. referenze</Table.Th>
                <Table.Th className="w-20 text-right">
                  <span className="sr-only">Azioni</span>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lavorazioniFiltrate.length > 0 ? lavorazioniFiltrate.map((lavorazione) => {
                const isManuale = lavorazione.tipo === TIPO_KIT_DESIGN.MANUALE;
                return (
                  <Table.Tr key={lavorazione.guidId} className={twMerge(promoChiusa && "opacity-60")}>
                    <Table.Td>
                      <FormCheck.Input type="checkbox" aria-label={`Seleziona ${lavorazione.titolo}`} checked={selectedLavorazioni.includes(lavorazione.guidId)} onChange={(e) => handleSelectOne(e, lavorazione.guidId)} disabled={promoChiusa} />
                    </Table.Td>
                    <Table.Td className="w-80">
                      <div className="whitespace-nowrap font-medium text-slate-800">{lavorazione.titolo}</div>
                      <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">{lavorazione.nomeArea} - {lavorazione.nomeCanale}</div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant={isManuale ? "warning" : "primary"} size="sm">
                        <Lucide icon={isManuale ? "FileDigit" : "Zap"} aria-hidden="true" className="h-3 w-3" />
                        {isManuale ? "Manuale" : "Automatico"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {/* Un kit di design non ancora avviato non ha uno stato di lavorazione */}
                      {lavorazione.lavorazioneStarted ? (
                        <StatusBadge dominio="kitRuntime" stato={(lavorazione as RUNTIME_KIT).stato_lavorazione} />
                      ) : (
                        <StatusBadge tono="neutral" etichetta="Non avviato" />
                      )}
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">{formatDataOra((lavorazione as any).updatedAt)}</Table.Td>
                    <Table.Td className="text-right tabular-nums">{(lavorazione as any).numero_files ? (lavorazione as any).numero_files : 0}</Table.Td>
                    <Table.Td className="text-right tabular-nums">{(lavorazione as any).numero_referenze ? (lavorazione as any).numero_referenze : 0}</Table.Td>
                    <Table.Td className="text-right">
                      {promoChiusa ? (
                        <Button variant="outline-secondary" size="sm" disabled aria-label="Promozione chiusa: il kit non si modifica" title="Promozione chiusa: il kit non si modifica">
                          <Lucide icon="Lock" aria-hidden="true" className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          as={Link}
                          to={`/promozioni/in-corso/dettagli/${datiLavorazione?.id}/kits/${lavorazione.guidId}`}
                          variant="outline-secondary"
                          size="sm"
                          aria-label={`Apri il kit ${lavorazione.titolo}`}
                        >
                          Apri
                          <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              }) : (
                <Table.Tr>
                  <Table.Td colSpan={COLONNE} className="p-0">
                    {searchQuery || tipoAttivo !== "TUTTI" ? (
                      <EmptyState
                        compatta
                        icon="SearchX"
                        title="Nessun risultato"
                        description={searchQuery ? `Nessuna lavorazione corrisponde a "${searchQuery}"` : "Nessuna lavorazione di questo tipo."}
                        buttonText="Azzera filtri"
                        buttonIcon="RotateCcw"
                        onButtonClick={() => {
                          setSearchQuery("");
                          setTipoAttivo("TUTTI");
                        }}
                      />
                    ) : (
                      <EmptyState
                        compatta
                        icon="Package"
                        title="Nessuna lavorazione"
                        description="Non sono presenti lavorazioni per questa promozione."
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(DettagliKitManualiInCorso);
