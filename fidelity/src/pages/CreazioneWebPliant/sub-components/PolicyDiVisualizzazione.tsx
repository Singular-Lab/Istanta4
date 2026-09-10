import Button from "@/components/Base/Button";
import { FormInput, FormSelect } from "@/components/Base/Form";
import MultiSelect from "@/components/Base/Form/MultiSelect";
import Lucide from "@/components/Base/Lucide";
import { useQueries } from "@tanstack/react-query";
import dayjs from "dayjs";
import _ from "lodash";
import React, { useEffect, useState } from "react";
import { FieldType, InteractionType } from "../../../../lib/enums";
import { ServerCall } from "../../../../lib/server_call";
import {
  DESIGN_KIT_MONGO,
  PolicyDiVisualizzazioneType,
  fieldsByInteractionType
} from "../../../../lib/types";
import { AreaResponseDTO, CanaleResponseDTO, PuntoVenditaResponseDTO } from "../../../../server/core/dto";

//
// Nuovo tipo per gestire DATA_SCADENZA come { operator, date }
//
interface DateFilterValue {
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains";
  date: string;
}

//
// Componente per il campo RICORRENZA
//
const RicorrenzaField: React.FC<{
  serializedValue: {
    type: string;
    startDate: string;
    endDate: string;
  };
  setPolicyValue: (val: any) => void;
}> = ({ serializedValue, setPolicyValue }) => {
  const { type: initType, startDate: initStart, endDate: initEnd } = serializedValue || {
    type: "",
    startDate: "",
    endDate: "",
  };

  const [localType, setLocalType] = useState<string>(initType);
  const [startDate, setStartDate] = useState<string>(initStart);
  const [endDate, setEndDate] = useState<string>(initEnd);

  useEffect(() => {
    const newObj = { type: localType, startDate, endDate };
    setPolicyValue(newObj);
  }, [localType, startDate, endDate]);

  const isInvalidRange =
    startDate && endDate && dayjs(endDate).isBefore(dayjs(startDate), "day");

  return (
    <div className="flex flex-col space-y-2 w-full">
      <FormSelect
        formSelectSize="sm"
        value={localType}
        onChange={(e) => setLocalType(e.target.value)}
      >
        <option value="">Seleziona una ricorrenza</option>
        <option value="daily">Ogni giorno</option>
        <option value="weekly">Ogni settimana</option>
        <option value="monthly">Ogni mese</option>
        <option value="yearly">Ogni anno</option>
        <option value="custom">Personalizzata</option>
      </FormSelect>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 w-24">Inizio</label>
        <FormInput
          formInputSize="sm"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-44"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 w-24">Fine</label>
        <FormInput
          formInputSize="sm"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-44"
        />
      </div>

      {isInvalidRange && (
        <p className="text-red-500 text-xs">
          La data di fine è precedente alla data di inizio!
        </p>
      )}

      {localType === "custom" && (
        <p className="text-sm text-gray-500">
          Configura qui la ricorrenza personalizzata...
        </p>
      )}
    </div>
  );
};

//
// Label formatter
//
const formatLabel = (label: string) =>
  label
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

//
// Props
//
interface PolicyDiVisualizzazioneProps {
  locked: boolean;
  handlePolicyDiVisualizzazione: () => void;
  tipo_interazione: InteractionType;
  oggettoPolicyDiVisualizzazione: PolicyDiVisualizzazioneType;
  updatePolicy: (newPolicy: PolicyDiVisualizzazioneType) => void;
}

const PolicyDiVisualizzazione: React.FC<PolicyDiVisualizzazioneProps> = ({
  locked,
  handlePolicyDiVisualizzazione,
  oggettoPolicyDiVisualizzazione,
  updatePolicy,
  tipo_interazione,
}) => {
  // 5 queries parallele
  const queryResults = useQueries({
    queries: [
      {
        queryKey: ["getAllKitRuntime"],
        queryFn: () => ServerCall.get<any[]>("/getAllKitRuntime"),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["allAreeForGDO"],
        queryFn: () => ServerCall.get<any[]>("/allAreeForGDO"),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["allCanaliForGDO"],
        queryFn: () => ServerCall.get<any[]>("/allCanaliForGDO"),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["getAllPVFromIdGDO"],
        queryFn: () => ServerCall.get<any[]>("/getAllPVFromIdGDO"),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["allReferenze"],
        queryFn: () => ServerCall.get<any[]>("/allReferenze"),
      },
    ],
  });
  const [kitAttivi, aree, canali, puntiVendita, allReferenze] = queryResults.map(
    (r) => r.data as any
  );

  // stato interno
  const [localPolicy, setLocalPolicy] = useState<PolicyDiVisualizzazioneType>(
    oggettoPolicyDiVisualizzazione
  );

  useEffect(() => {
    if (!_.isEqual(localPolicy, oggettoPolicyDiVisualizzazione)) {
      setLocalPolicy(oggettoPolicyDiVisualizzazione);
    }
  }, [oggettoPolicyDiVisualizzazione]);

  useEffect(() => {
    if (!_.isEqual(localPolicy, oggettoPolicyDiVisualizzazione)) {
      updatePolicy(localPolicy);
    }
  }, [localPolicy]);

  // aggiunge regole
  const handleAddVisualizzazioneRegola = () => {
    const np = { ...localPolicy };
    np.visualizzazione.push({ inclusione: [], esclusione: [] });
    setLocalPolicy(np);
  };
  const handleAddFiltriRegola = () => {
    const np = { ...localPolicy };
    np.filtri_contenuto.push({ inclusione: [], esclusione: [] });
    setLocalPolicy(np);
  };

  // aggiunge item
  const handleAddInclusione = (
    section: "visualizzazione" | "filtri_contenuto",
    ri: number
  ) => {
    const np = { ...localPolicy };
    np[section][ri].inclusione.push({ tipo: FieldType.VUOTO, valore: "" });
    setLocalPolicy(np);
  };
  const handleAddEsclusione = (
    section: "visualizzazione" | "filtri_contenuto",
    ri: number
  ) => {
    const np = { ...localPolicy };
    np[section][ri].esclusione.push({ tipo: FieldType.VUOTO, valore: "" });
    setLocalPolicy(np);
  };

  // modifica tipo o valore
  const handleChangeItem = (
    section: "visualizzazione" | "filtri_contenuto",
    regolaIndex: number,
    arrayName: "inclusione" | "esclusione",
    itemIndex: number,
    field: "tipo" | "valore",
    newValue: any
  ) => {
    const np = { ...localPolicy };
    const item = np[section][regolaIndex][arrayName][itemIndex];

    if (field === "tipo") {
      item.tipo = newValue as FieldType;
      if (newValue === FieldType.DATA_SCADENZA) {
        item.valore = { operator: "equals", date: "" } as DateFilterValue;
      } else {
        item.valore = "";
      }
    } else {
      item.valore = newValue;
    }

    setLocalPolicy(np);
  };

  // rimuove item o regola
  const handleRemoveItem = (
    section: "visualizzazione" | "filtri_contenuto",
    ri: number,
    arrayName: "inclusione" | "esclusione",
    ii: number
  ) => {
    const np = { ...localPolicy };
    np[section][ri][arrayName].splice(ii, 1);
    setLocalPolicy(np);
  };
  const handleRemoveRegola = (
    section: "visualizzazione" | "filtri_contenuto",
    ri: number
  ) => {
    const np = { ...localPolicy };
    np[section].splice(ri, 1);
    setLocalPolicy(np);
  };

  // render dei valori possibili
  const renderPossibleValues = (
    tipo: FieldType,
    value: any,
    setPolicyValue: (val: any) => void
  ) => {
    switch (tipo) {
      case FieldType.CANALE: {
        const opts = canali?.map((c: CanaleResponseDTO) => ({
          id: c.id,
          name: c.nome,
        }));
        const sel = opts?.filter((o: { id: any; }) => Array.isArray(value) && value.includes(o.id));
        return (
          <MultiSelect
            formSelectSize="sm"
            options={opts}
            value={sel}
            onChangefunc={(sel) => {
              if (Array.isArray(sel)) setPolicyValue(sel.map((s) => s.id));
              else setPolicyValue(sel?.id || "");
            }}
          />
        );
      }

      case FieldType.REFERENZE: {
        const refs = allReferenze?.map((r: any) => ({ id: r.codice, name: r.codice }));
        const sel = refs?.filter((r: { id: any; }) => Array.isArray(value) && value.includes(r.id));
        return (
          <MultiSelect
            formSelectSize="sm"
            options={refs}
            value={sel}
            onChangefunc={(sel) => {
              if (Array.isArray(sel)) setPolicyValue(sel.map((s) => s.id));
              else setPolicyValue(sel?.id || "");
            }}
          />
        );
      }

      case FieldType.AREA:
        return (
          <FormSelect formSelectSize="sm" value={value} onChange={(e) => setPolicyValue(e.target.value)}>
            <option value="">Seleziona un'area</option>
            {aree?.map((a: AreaResponseDTO) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </FormSelect>
        );

      case FieldType.PUNTO_VENDITA:
        return (
          <FormSelect formSelectSize="sm" value={value} onChange={(e) => setPolicyValue(e.target.value)}>
            <option value="">Seleziona un punto vendita</option>
            {puntiVendita?.map((pv: PuntoVenditaResponseDTO) => (
              <option key={pv.id} value={pv.id}>
                {pv.nome}
              </option>
            ))}
          </FormSelect>
        );

      case FieldType.CONTESTO_KIT:
        return (
          <FormSelect formSelectSize="sm" value={value} onChange={(e) => setPolicyValue(e.target.value)}>
            <option value="">Seleziona un kit</option>
            {kitAttivi?.map((k: DESIGN_KIT_MONGO) => (
              <option key={k.guidId} value={k.guidId}>
                {k.titolo}
              </option>
            ))}
          </FormSelect>
        );

      case FieldType.DATA_SCADENZA: {
        const { operator = "", date = "" } = (value as DateFilterValue) || {};
        return (
          <>
            <FormSelect
              formSelectSize="sm"
              value={operator}
              onChange={(e) => setPolicyValue({ operator: e.target.value, date })}
            >
              <option value="">Operatore</option>
              <option value="equals">Uguale a</option>
              <option value="not_equals">Diverso da</option>
              <option value="greater_than">Maggiore di</option>
              <option value="less_than">Minore di</option>
              <option value="contains">Contiene</option>
              <option value="not_contains">Non contiene</option>
            </FormSelect>
            <FormInput
              formInputSize="sm"
              type="date"
              value={date}
              onChange={(e) => setPolicyValue({ operator, date: e.target.value })}
            />
          </>
        );
      }

      case FieldType.RICORRENZA:
        return (
          <RicorrenzaField
            serializedValue={value}
            setPolicyValue={(v) => setPolicyValue(v)}
          />
        );

      default:
        return <FormInput formInputSize="sm" type="text" disabled />;
    }
  };

  // render principale
  return (
    <div className="border border-gray-200 rounded-md p-4 mt-4">
      <Button
        size="xs"
        onClick={handlePolicyDiVisualizzazione}
        className="w-full mb-4"
      >
        {locked ? "Disabilita" : "Abilita"} Policy di Visualizzazione
      </Button>

      {locked && (
        <div className="space-y-6">
          {/* --- Sezione VISUALIZZAZIONE --- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-semibold">Visualizzazione</h3>
              <Button size="xs" variant="primary" onClick={handleAddVisualizzazioneRegola}>
                Aggiungi Regola
              </Button>
            </div>
            {localPolicy?.visualizzazione?.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Nessuna regola di visualizzazione impostata.
              </p>
            ) : (
              localPolicy?.visualizzazione?.map((visual, i) => (
                <div
                  key={i}
                  className="p-3 mb-3 border border-gray-100 rounded-md bg-gray-50 relative"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveRegola("visualizzazione", i)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                  >
                    <Lucide icon="Trash2" className="w-4 h-4" />
                  </button>
                  <p className="font-medium text-sm text-gray-700 mb-2">
                    Regola n. {i + 1}
                  </p>

                  {/* INCLUSIONE */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-gray-600 font-semibold">Includi se</p>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => handleAddInclusione("visualizzazione", i)}
                      >
                        + Aggiungi
                      </Button>
                    </div>
                    {visual.inclusione.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Nessuna inclusione</p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {visual.inclusione.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-white p-2 rounded">
                            <FormSelect
                              formSelectSize="sm"
                              value={item.tipo}
                              onChange={(e) =>
                                handleChangeItem(
                                  "visualizzazione",
                                  i,
                                  "inclusione",
                                  idx,
                                  "tipo",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Seleziona un tipo</option>
                              {fieldsByInteractionType[tipo_interazione].map((f) => (
                                <option key={f} value={f}>
                                  {formatLabel(f)}
                                </option>
                              ))}
                            </FormSelect>
                            {renderPossibleValues(item.tipo, item.valore, (val) =>
                              handleChangeItem(
                                "visualizzazione",
                                i,
                                "inclusione",
                                idx,
                                "valore",
                                val
                              )
                            )}
                            <button
                              onClick={() =>
                                handleRemoveItem("visualizzazione", i, "inclusione", idx)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <Lucide icon="Trash2" className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* ESCLUSIONE */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-gray-600 font-semibold">Escludi se</p>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => handleAddEsclusione("visualizzazione", i)}
                      >
                        + Aggiungi
                      </Button>
                    </div>
                    {visual.esclusione.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Nessuna esclusione</p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {visual.esclusione.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-white p-2 rounded">
                            <FormSelect
                              formSelectSize="sm"
                              value={item.tipo}
                              onChange={(e) =>
                                handleChangeItem(
                                  "visualizzazione",
                                  i,
                                  "esclusione",
                                  idx,
                                  "tipo",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Seleziona un tipo</option>
                              {fieldsByInteractionType[tipo_interazione].map((f) => (
                                <option key={f} value={f}>
                                  {formatLabel(f)}
                                </option>
                              ))}
                            </FormSelect>
                            {renderPossibleValues(item.tipo, item.valore, (val) =>
                              handleChangeItem(
                                "visualizzazione",
                                i,
                                "esclusione",
                                idx,
                                "valore",
                                val
                              )
                            )}
                            <button
                              onClick={() =>
                                handleRemoveItem("visualizzazione", i, "esclusione", idx)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <Lucide icon="Trash2" className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <hr />

          {/* --- Sezione FILTRI DI CONTENUTO --- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-semibold">Filtri di Contenuto</h3>
              <Button size="xs" variant="primary" onClick={handleAddFiltriRegola}>
                Aggiungi Regola
              </Button>
            </div>
            {localPolicy?.filtri_contenuto?.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Nessuna regola di filtro impostata.</p>
            ) : (
              localPolicy?.filtri_contenuto?.map((filtro, i) => (
                <div
                  key={i}
                  className="p-3 mb-3 border border-gray-100 rounded-md bg-gray-50 relative"
                >
                  <button
                    onClick={() => handleRemoveRegola("filtri_contenuto", i)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                  >
                    <Lucide icon="Trash2" className="w-4 h-4" />
                  </button>
                  <p className="font-medium text-sm text-gray-700 mb-2">Filtro n. {i + 1}</p>

                  {/* INCLUSIONE */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-gray-600 font-semibold">Includi se</p>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => handleAddInclusione("filtri_contenuto", i)}
                      >
                        + Aggiungi
                      </Button>
                    </div>
                    {filtro.inclusione.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Nessuna inclusione</p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {filtro.inclusione.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-white p-2 rounded">
                            <FormSelect
                              formSelectSize="sm"
                              value={item.tipo}
                              onChange={(e) =>
                                handleChangeItem(
                                  "filtri_contenuto",
                                  i,
                                  "inclusione",
                                  idx,
                                  "tipo",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Seleziona un tipo</option>
                              {fieldsByInteractionType[tipo_interazione].map((f) => (
                                <option key={f} value={f}>
                                  {formatLabel(f)}
                                </option>
                              ))}
                            </FormSelect>
                            {renderPossibleValues(item.tipo, item.valore, (val) =>
                              handleChangeItem(
                                "filtri_contenuto",
                                i,
                                "inclusione",
                                idx,
                                "valore",
                                val
                              )
                            )}
                            <button
                              onClick={() =>
                                handleRemoveItem("filtri_contenuto", i, "inclusione", idx)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <Lucide icon="Trash2" className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* ESCLUSIONE */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-gray-600 font-semibold">Escludi se</p>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => handleAddEsclusione("filtri_contenuto", i)}
                      >
                        + Aggiungi
                      </Button>
                    </div>
                    {filtro.esclusione.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Nessuna esclusione</p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {filtro.esclusione.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-white p-2 rounded">
                            <FormSelect
                              formSelectSize="sm"
                              value={item.tipo}
                              onChange={(e) =>
                                handleChangeItem(
                                  "filtri_contenuto",
                                  i,
                                  "esclusione",
                                  idx,
                                  "tipo",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Seleziona un tipo</option>
                              {fieldsByInteractionType[tipo_interazione].map((f) => (
                                <option key={f} value={f}>
                                  {formatLabel(f)}
                                </option>
                              ))}
                            </FormSelect>
                            {renderPossibleValues(item.tipo, item.valore, (val) =>
                              handleChangeItem(
                                "filtri_contenuto",
                                i,
                                "esclusione",
                                idx,
                                "valore",
                                val
                              )
                            )}
                            <button
                              onClick={() =>
                                handleRemoveItem("filtri_contenuto", i, "esclusione", idx)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <Lucide icon="Trash2" className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyDiVisualizzazione;
