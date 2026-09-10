import React, { useState } from "react";
import { Await, useLoaderData, useNavigate } from "react-router-dom";
import { Fragment } from "react/jsx-runtime";
import { STATO_GDO_WHATSAPP_NUMBER } from "../../../lib/enums";
import Badge from "../../components/Base/Badge";
import Button from "../../components/Base/Button";
import Lucide from "../../components/Base/Lucide";
import PageHeader from "../../components/Base/PageHeader";
import Table from "../../components/Base/Table";
import withSessionCheck from "../../components/SessionChecker";


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

  const renderBadgeStatoWhatsapp = (stato: STATO_GDO_WHATSAPP_NUMBER) => {
    switch (stato) {
      case STATO_GDO_WHATSAPP_NUMBER.PENDING:
        return <Badge border size="sm" variant="warning">In attesa di verifica</Badge>;
      case STATO_GDO_WHATSAPP_NUMBER.VERIFIED:
        return <Badge border size="sm" variant="success">Verificato</Badge>;
      case STATO_GDO_WHATSAPP_NUMBER.PAUSED:
        return <Badge border size="sm" variant="error">In pausa</Badge>;
      default:
        return <Badge border size="sm" variant="secondary">Sconosciuto</Badge>;
    }
  };

  const getStatoIcon = (stato: STATO_GDO_WHATSAPP_NUMBER) => {
    switch (stato) {
      case STATO_GDO_WHATSAPP_NUMBER.VERIFIED:
        return <Lucide icon="CircleCheck" className="w-4 h-4 text-success mr-1" />;
      case STATO_GDO_WHATSAPP_NUMBER.PENDING:
        return <Lucide icon="Clock" className="w-4 h-4 text-warning mr-1" />;
      case STATO_GDO_WHATSAPP_NUMBER.PAUSED:
        return <Lucide icon="CirclePause" className="w-4 h-4 text-error mr-1" />;
      default:
        return <Lucide icon="CircleHelp" className="w-4 h-4 text-slate-500 mr-1" />;
    }
  };

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
  document.getElementById
  return (
    <Fragment>
      <PageHeader
        title="Gestione WhatsApp"
        description="Gestisci le configurazioni WhatsApp Business per i GDO"
      />
      <div className="col-span-12">
        <div className="box box--stacked">
          {/* Header con ricerca e filtri */}
          <div className="p-5 border-b border-slate-200/60">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:w-auto">
                <div className="relative">
                  <Lucide icon="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca per nome GDO, ragione sociale, email o numero..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                  value={filterStato}
                  onChange={(e) => setFilterStato(e.target.value)}
                >
                  <option value="all">Tutti gli stati</option>
                  <option value={STATO_GDO_WHATSAPP_NUMBER.VERIFIED}>Verificato</option>
                  <option value={STATO_GDO_WHATSAPP_NUMBER.PENDING}>In attesa</option>
                  <option value={STATO_GDO_WHATSAPP_NUMBER.PAUSED}>In pausa</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabella */}
          <div className="overflow-x-auto">
            <React.Suspense fallback={
              <div className="flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-3">
                  <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-slate-500">Caricamento dati...</p>
                </div>
              </div>
            }>
              <Await resolve={gdos_lista}>
                {(gdos_lista) => {
                  const filteredGdos = filterGdos(gdos_lista);

                  if (filteredGdos.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <Lucide icon="Search" className="w-12 h-12 mb-3 text-slate-400" />
                        <p className="text-lg font-medium">Nessun risultato trovato</p>
                        <p className="text-sm">Prova a modificare i criteri di ricerca</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Contatore risultati */}
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/60">
                        <p className="text-sm text-slate-600">
                          Trovati <span className="font-semibold text-slate-800">{filteredGdos.length}</span> GDO
                        </p>
                      </div>

                      <Table className="w-full" bordered striped>
                        <Table.Thead className="bg-slate-50">
                          <Table.Tr>
                            <Table.Th className="font-semibold">GDO</Table.Th>
                            <Table.Th className="font-semibold">Contatti</Table.Th>
                            <Table.Th className="font-semibold">WhatsApp</Table.Th>
                            <Table.Th className="font-semibold">Stato</Table.Th>
                            <Table.Th className="font-semibold text-center">Azioni</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {filteredGdos.map((gdo) => (
                            <Table.Tr
                              key={gdo.id ?? ''}
                              className="hover:bg-slate-50 transition-colors [&_td]:last:border-b-0"
                            >
                              {/* Colonna GDO */}
                              <Table.Td className="py-4">
                                <div className="flex flex-col gap-1">
                                  <a
                                    href={`/gdo/${gdo?.id}`}
                                    className="text-primary font-medium hover:text-primary-dark transition-colors flex items-center gap-1 group"
                                  >
                                    {gdo?.nome ?? ''}
                                    <Lucide icon="ExternalLink" className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    {gdo?.id_parent && (
                                      <span className="flex items-center gap-1">
                                        <Lucide icon="Link2" className="w-3 h-3" />
                                        Parent: {gdo.id_parent}
                                      </span>
                                    )}
                                    {gdo?.createdat && (
                                      <span className="flex items-center gap-1">
                                        <Lucide icon="Calendar" className="w-3 h-3" />
                                        {new Date(gdo.createdat).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Table.Td>

                              {/* Colonna Contatti */}
                              <Table.Td className="py-4">
                                <div className="flex flex-col gap-1.5">
                                  {gdo?.ragione_sociale && (
                                    <div className="flex items-start gap-1.5">
                                      <Lucide icon="Building2" className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                      <span className="text-sm">{gdo.ragione_sociale}</span>
                                    </div>
                                  )}
                                  {gdo?.email && (
                                    <div className="flex items-center gap-1.5">
                                      <Lucide icon="Mail" className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span className="text-sm text-slate-600">{gdo.email}</span>
                                    </div>
                                  )}
                                  {!gdo?.ragione_sociale && !gdo?.email && (
                                    <span className="text-sm text-slate-400">-</span>
                                  )}
                                </div>
                              </Table.Td>

                              {/* Colonna WhatsApp */}
                              <Table.Td className="py-4">
                                <div className="flex flex-col gap-1.5">
                                  {gdo?.wa_number ? (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <Lucide icon="Phone" className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                        <span className="text-sm font-medium">{gdo.wa_number}</span>
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
                              <Table.Td className="py-4">
                                <div className="flex items-center">
                                  {getStatoIcon(gdo?.stato as STATO_GDO_WHATSAPP_NUMBER)}
                                  {renderBadgeStatoWhatsapp(gdo?.stato as STATO_GDO_WHATSAPP_NUMBER)}
                                </div>
                              </Table.Td>

                              {/* Colonna Azioni */}
                              <Table.Td className="py-4">
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    onClick={() => navigate("setup?id=" + gdo.id)}
                                    size="sm"
                                    variant="outline-primary"
                                    className="flex items-center gap-1.5"
                                  >
                                    <Lucide icon="Settings" className="w-3.5 h-3.5" />
                                    Setup
                                  </Button>
                                  <Button
                                    onClick={() => navigate("templates?id=" + gdo.id)}
                                    size="sm"
                                    variant="outline-secondary"
                                    className="flex items-center gap-1.5"
                                  >
                                    <Lucide icon="FileText" className="w-3.5 h-3.5" />
                                    Templates
                                  </Button>
                                </div>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </>
                  );
                }}
              </Await>
            </React.Suspense>
          </div>
        </div>
      </div>
    </Fragment>
  );
};


export default withSessionCheck(GestioneWhatsappSuperAdmin);
