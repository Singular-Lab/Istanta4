import React, { useState } from "react";
import { Await, Link, useAsyncError, useLoaderData, useNavigate } from "react-router-dom";
import { STATO_GDO_WHATSAPP_NUMBER } from "../../../lib/enums";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { descriviStato } from "@/constants/stati";
import { formatData, VALORE_ASSENTE } from "@/utils/format";

const COLONNE = 5;

/** Errore del caricamento differito delle GDO, mostrato al posto della tabella. */
function ErroreGdo() {
  const errore = useAsyncError() as { message?: string } | undefined;
  return (
    <div className="p-5">
      <PageError
        compatta
        titolo="Impossibile caricare le GDO"
        motivo={errore?.message || "Non è stato possibile recuperare l'elenco delle GDO."}
      />
    </div>
  );
}

const GestioneWhatsappSuperAdmin: React.FC = () => {
  const {
    gdos_lista,
  } = useLoaderData<{
    //FIXME a questo ci deve andare il tipo
    gdos_lista: any[];
  }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStato, setFilterStato] = useState<string>("all");

  const filterGdos = (gdos: any[]) => {
    return gdos.filter((gdo) => {
      const matchesSearch =
        gdo?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gdo?.ragione_sociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gdo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gdo?.wa_number?.includes(searchTerm);

      const matchesStato = filterStato === "all" || gdo?.stato === filterStato;

      return matchesSearch && matchesStato;
    });
  };

  const filtriAttivi = searchTerm !== "" || filterStato !== "all";

  return (
    <Pagina
      titolo="Gestione WhatsApp"
      descrizione="Gestisci le configurazioni WhatsApp Business per i GDO"
    >
      <Sezione senzaPadding titolo="GDO" descrizione="Numeri WhatsApp Business configurati per ogni GDO">
        <BarraFiltri>
          <CampoRicerca
            etichetta="Cerca GDO"
            placeholder="Nome GDO, ragione sociale, email o numero"
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <FormSelect
            formSelectSize="sm"
            aria-label="Filtra per stato"
            className="sm:w-56"
            value={filterStato}
            onChange={(e) => setFilterStato(e.target.value)}
          >
            <option value="all">Tutti gli stati</option>
            {Object.values(STATO_GDO_WHATSAPP_NUMBER).map((stato) => (
              <option key={stato} value={stato}>{descriviStato("waNumero", stato).etichetta}</option>
            ))}
          </FormSelect>
        </BarraFiltri>

        <React.Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <Spinner size="lg" etichetta="Caricamento dati…" />
          </div>
        }>
          <Await resolve={gdos_lista} errorElement={<ErroreGdo />}>
            {(gdos_lista) => {
              const filteredGdos = filterGdos(gdos_lista);

              return (
                <>
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>GDO</Table.Th>
                          <Table.Th>Contatti</Table.Th>
                          <Table.Th>WhatsApp</Table.Th>
                          <Table.Th>Stato</Table.Th>
                          <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredGdos.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={COLONNE} className="p-0">
                              {filtriAttivi && gdos_lista.length > 0 ? (
                                <EmptyState
                                  compatta
                                  icon="SearchX"
                                  title="Nessun risultato"
                                  description="Nessuna GDO corrisponde alla ricerca o al filtro scelto."
                                  buttonText="Azzera filtri"
                                  buttonIcon="X"
                                  onButtonClick={() => {
                                    setSearchTerm("");
                                    setFilterStato("all");
                                  }}
                                />
                              ) : (
                                <EmptyState
                                  compatta
                                  icon="Store"
                                  title="Nessuna GDO"
                                  description="Non ci sono ancora GDO da configurare."
                                />
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {filteredGdos.map((gdo) => (
                          <Table.Tr key={gdo.id ?? ''}>
                            {/* Colonna GDO */}
                            <Table.Td>
                              <div className="flex flex-col gap-1">
                                <Link
                                  to={`/gdo/${gdo?.id}`}
                                  className="group flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
                                >
                                  {gdo?.nome ?? ''}
                                  <Lucide icon="ExternalLink" aria-hidden="true" className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                                </Link>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  {gdo?.id_parent && (
                                    <span className="flex items-center gap-1">
                                      <Lucide icon="Link2" aria-hidden="true" className="h-3 w-3" />
                                      Parent: {gdo.id_parent}
                                    </span>
                                  )}
                                  {gdo?.createdat && (
                                    <span className="flex items-center gap-1">
                                      <Lucide icon="Calendar" aria-hidden="true" className="h-3 w-3" />
                                      {formatData(gdo.createdat)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Table.Td>

                            {/* Colonna Contatti */}
                            <Table.Td>
                              <div className="flex flex-col gap-1.5">
                                {gdo?.ragione_sociale && (
                                  <div className="flex items-start gap-1.5">
                                    <Lucide icon="Building2" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                    <span className="text-sm">{gdo.ragione_sociale}</span>
                                  </div>
                                )}
                                {gdo?.email && (
                                  <div className="flex items-center gap-1.5">
                                    <Lucide icon="Mail" aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                    <span className="text-sm text-slate-600">{gdo.email}</span>
                                  </div>
                                )}
                                {!gdo?.ragione_sociale && !gdo?.email && (
                                  <span className="text-sm text-slate-400">{VALORE_ASSENTE}</span>
                                )}
                              </div>
                            </Table.Td>

                            {/* Colonna WhatsApp */}
                            <Table.Td>
                              <div className="flex flex-col gap-1.5">
                                {gdo?.wa_number ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <Lucide icon="Phone" aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                                      <span className="text-sm font-medium tabular-nums">{gdo.wa_number}</span>
                                    </div>
                                    {gdo?.wa_phone_id && (
                                      <span className="text-xs text-slate-500">ID: {gdo.wa_phone_id}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-slate-400">Non configurato</span>
                                )}
                              </div>
                            </Table.Td>

                            {/* Colonna Stato */}
                            <Table.Td>
                              {gdo?.stato
                                ? <StatusBadge dominio="waNumero" stato={gdo.stato} />
                                : <StatusBadge tono="neutral" etichetta="Non configurato" />}
                            </Table.Td>

                            {/* Colonna Azioni: due azioni, pulsanti solo icona */}
                            <Table.Td className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => navigate("setup?id=" + gdo.id)}
                                  size="sm"
                                  variant="outline-secondary"
                                  aria-label={`Setup WhatsApp di ${gdo?.nome ?? "GDO"}`}
                                  title="Setup"
                                >
                                  <Lucide icon="Settings" aria-hidden="true" className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  onClick={() => navigate("templates?id=" + gdo.id)}
                                  size="sm"
                                  variant="outline-secondary"
                                  aria-label={`Template WhatsApp di ${gdo?.nome ?? "GDO"}`}
                                  title="Templates"
                                >
                                  <Lucide icon="FileText" aria-hidden="true" className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                  {filteredGdos.length > 0 && (
                    <p className="px-5 py-3 text-sm text-slate-500" aria-live="polite">
                      Trovate <span className="font-medium text-slate-700 tabular-nums">{filteredGdos.length}</span> GDO
                    </p>
                  )}
                </>
              );
            }}
          </Await>
        </React.Suspense>
      </Sezione>
    </Pagina>
  );
};


export default withSessionCheck(GestioneWhatsappSuperAdmin);
