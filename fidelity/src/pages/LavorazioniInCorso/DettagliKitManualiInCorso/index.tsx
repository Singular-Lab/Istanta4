import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import { FormCheck, FormInput } from "@/components/Base/Form";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { formatDataOra, valoreOAssente } from "@/utils/format";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useLocation, useParams } from "react-router-dom";
import { STATO_PROMO, TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { DESIGN_KIT, RUNTIME_KIT, TipiDiExportAttributes } from "../../../../lib/types";
import { PromoResponseDTO } from "../../../../server/core/dto";
type Lavorazione = (DESIGN_KIT & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[] }) | (RUNTIME_KIT & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[], numero_files: number, numero_referenze: number });

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
  const [tipoAttivo, setTipoAttivo] = useState<'TUTTI' | 'MANUALI' | 'AUTOMATICI'>('TUTTI');
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
    <>
      <div className="grid grid-cols-12 gap-y-6 gap-x-6 ">
        <div className="col-span-12 mb-10">
          {/* Header con informazioni sulla lavorazione */}
          <div className=" shadow-sm ">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col">
                <PageHeader
                  title={valoreOAssente(datiLavorazione?.nome)}
                  description="Gestione lavorazioni manuali e automatiche"
                  indietro={{ to: `/promozioni/${sezione}/dettagli/${idPromo ?? datiLavorazione?.id}`, etichetta: "Torna alla promozione" }}
                />
              </div>
            </div>
          </div>
          {/* Box contenitore principale */}
          <div className="box p-0 overflow-hidden">
            {/* Barra di ricerca e filtri */}
            <div className="bg-slate-50 border-b border-slate-200 p-5">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-7 xl:col-span-8">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lucide icon="Search" className="w-4 h-4 text-slate-400" />
                    </div>
                    <FormInput
                      type="text"
                      aria-label="Cerca lavorazioni"
                      placeholder="Cerca per titolo, canale, area..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-5 xl:col-span-4">
                  <div className="flex sm:flex-row xs:flex-col xs:items-end 2xl:items-center gap-y-3">
                    <Tab.Group>
                      <Tab.List
                        variant="boxed-tabs"
                        className="flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-card border-slate-200"
                      >
                        <Tab className="bg-slate-50 first:rounded-l-card last:rounded-r-card [&[aria-selected='true']_button]:text-current">
                          <Tab.Button
                            className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-control flex items-center justify-center text-sm"
                            as="button"
                            onClick={() => setTipoAttivo('TUTTI')}
                          >
                            <Lucide icon="LayoutGrid" className="w-4 h-4 mr-1.5" />
                            Tutti
                            <span className="ml-1.5 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {lavorazioniCounts.total}
                            </span>
                          </Tab.Button>
                        </Tab>
                        <Tab className="bg-slate-50 first:rounded-l-card last:rounded-r-card [&[aria-selected='true']_button]:text-current">
                          <Tab.Button
                            className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-control flex items-center justify-center text-sm"
                            as="button"
                            onClick={() => setTipoAttivo('MANUALI')}
                          >
                            <Lucide icon="FileDigit" className="w-4 h-4 mr-1.5" />
                            Manuali
                            <span className="ml-1.5 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {lavorazioniCounts.manuali}
                            </span>
                          </Tab.Button>
                        </Tab>
                        <Tab className="bg-slate-50 first:rounded-l-card last:rounded-r-card [&[aria-selected='true']_button]:text-current">
                          <Tab.Button
                            className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-control flex items-center justify-center text-sm"
                            as="button"
                            onClick={() => setTipoAttivo('AUTOMATICI')}
                          >
                            <Lucide icon="Zap" className="w-4 h-4 mr-1.5" />
                            Automatici
                            <span className="ml-1.5 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {lavorazioniCounts.automatici}
                            </span>
                          </Tab.Button>
                        </Tab>
                      </Tab.List>
                    </Tab.Group>
                  </div>
                </div>
              </div>
            </div>

            <div className="">
              {/* Conteggio risultati */}
              <div className="flex justify-between items-center mb-5 p-5">
                <div className="text-sm text-slate-500">
                  {lavorazioniFiltrate.length} {lavorazioniFiltrate.length === 1 ? 'risultato' : 'risultati'} trovati
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-primary hover:text-primary/80 flex items-center"
                  >
                    <Lucide icon="X" className="w-4 h-4 mr-1" />
                    Cancella ricerca
                  </button>
                )}
              </div>

              {/* Risultati */}
              <div className="overflow-x-auto">
                <Table bordered className="border-b border-slate-200/60">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Td className="w-5 py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        <FormCheck.Input type="checkbox" aria-label="Seleziona tutte le lavorazioni" onChange={handleSelectAll} checked={selectedLavorazioni.length === lavorazioniFiltrate.length && lavorazioniFiltrate.length > 0} />
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">Lavorazione</Table.Td>
                      <Table.Td className="py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">Tipo</Table.Td>
                      <Table.Td className="py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">Stato</Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">Ultima Modifica</Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">N. Files</Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">N. Referenze</Table.Td>
                      <Table.Td className="w-20 py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">Azioni</Table.Td>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lavorazioniFiltrate.length > 0 ? lavorazioniFiltrate.map((lavorazione) => {
                      const isManuale = lavorazione.tipo === TIPO_KIT_DESIGN.MANUALE;
                      return (
                        <Table.Tr key={lavorazione.guidId} className={clsx("[&_td]:last:border-b-0", promoChiusa && "opacity-60 bg-slate-50")}>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                            <FormCheck.Input type="checkbox" aria-label={`Seleziona ${lavorazione.titolo}`} checked={selectedLavorazioni.includes(lavorazione.guidId)} onChange={(e) => handleSelectOne(e, lavorazione.guidId)} disabled={promoChiusa} />
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed w-80 dark:bg-darkmode-600">
                            <div>
                              <div className="font-medium whitespace-nowrap">{lavorazione.titolo}</div>
                              <div className="text-slate-500 text-xs whitespace-nowrap mt-0.5">{lavorazione.nomeArea} - {lavorazione.nomeCanale}</div>
                            </div>
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                            <Badge variant="primary" className={isManuale ? "text-xs px-2 py-1 text-pending" : "text-xs px-2 py-1 text-primary"} >
                              <Lucide icon={isManuale ? 'FileDigit' : 'Zap'} className="w-4 h-4 mr-1" />
                              {isManuale ? 'Manuale' : 'Automatico'}
                            </Badge>
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                            {/* Un kit di design non ancora avviato non ha uno stato di lavorazione */}
                            {lavorazione.lavorazioneStarted ? (
                              <StatusBadge dominio="kitRuntime" stato={(lavorazione as RUNTIME_KIT).stato_lavorazione} />
                            ) : (
                              <StatusBadge tono="neutral" etichetta="Non avviato" />
                            )}
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                            <div className="whitespace-nowrap">{formatDataOra((lavorazione as any).updatedAt)}</div>
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                            <div className="whitespace-nowrap">{(lavorazione as any).numero_files ? (lavorazione as any).numero_files : 0}</div>
                          </Table.Td>
                          <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                            <div className="whitespace-nowrap">{(lavorazione as any).numero_referenze ? (lavorazione as any).numero_referenze : 0}</div>
                          </Table.Td>
                          <Table.Td className="relative py-4 border-dashed dark:bg-darkmode-600">
                            <div className="flex items-center justify-center">
                              {promoChiusa ? (
                                <Button variant="secondary" size="sm" className="px-2 py-1" disabled aria-label="Promozione chiusa: il kit non si modifica" title="Promozione chiusa: il kit non si modifica">
                                  <Lucide icon="Lock" aria-hidden="true" className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  as={Link}
                                  to={`/promozioni/in-corso/dettagli/${datiLavorazione?.id}/kits/${lavorazione.guidId}`}
                                  variant="primary"
                                  size="sm"
                                  className="px-2 py-1"
                                  aria-label={`Apri il kit ${lavorazione.titolo}`}
                                >
                                  <Lucide icon="ArrowRight" aria-hidden="true" className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      );
                    }) : (
                      <Table.Tr className="[&_td]:last:border-b-0">
                        <Table.Td colSpan={8} className="py-8 border-dashed dark:bg-darkmode-600">
                          <EmptyState
                            icon="Search"
                            title="Nessuna lavorazione trovata"
                            description={searchQuery
                              ? `Nessuna lavorazione corrisponde a "${searchQuery}"`
                              : "Non sono presenti lavorazioni per questa promozione."
                            }
                          />
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default withSessionCheck(DettagliKitManualiInCorso);
