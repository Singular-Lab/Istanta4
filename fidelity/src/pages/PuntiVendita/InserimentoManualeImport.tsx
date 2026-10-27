import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import clsx from "clsx";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ServerCall } from "../../../lib/server_call";
import type { IndirizzoTrovatoDTO, RigaInAttesaImportDTO } from "../../../server/core/dto";
import {
  applicaIndirizzo,
  canaliEAree,
  chiaveIndirizzo,
  classePunteggio,
  combinazioneDi,
  coordinateDaTesto,
  inserimentoCompleto,
  type CombinazioneDisponibile,
  type DatiInserimentoManuale,
} from "../../utils/importPuntiVendita";

const datiDa = (riga: RigaInAttesaImportDTO): DatiInserimentoManuale => ({
  nome: riga.dati.nome ?? "",
  indirizzo: riga.dati.indirizzo ?? "",
  citta: riga.dati.citta ?? "",
  cap: riga.dati.cap ?? "",
  provincia: riga.dati.provincia ?? "",
  regione: riga.dati.regione ?? "",
  telefono: riga.dati.telefono ?? "",
  ragioneSociale: riga.dati.ragionesociale ?? "",
  guidIDCombinazione: riga.dati.id_combinazione_canale_area ?? "",
});

/** Centra la mappa sul risultato scelto, o sull'insieme dei risultati. */
function Inquadra({ punti }: { punti: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (punti.length === 1) map.setView(punti[0], 17);
    else if (punti.length > 1) map.fitBounds(punti, { padding: [30, 30] });
  }, [map, punti]);
  return null;
}

/**
 * Modale della riga su cui l'import e fermo: l'utente cerca l'indirizzo su Nominatim, sceglie
 * sulla mappa OpenStreetMap quello giusto, sceglie canale e area e salva; poi l'import riprende.
 * Se Nominatim non trova il punto vendita, la posizione si conferma incollando le coordinate
 * copiate da Google Maps.
 */
export function InserimentoManualeImport({
  riga,
  combinazioni,
  onDecidi,
  onAnnullaImport,
  onRiduci,
  annullamentoInCorso,
}: {
  riga: RigaInAttesaImportDTO;
  combinazioni: CombinazioneDisponibile[];
  onDecidi: (decisione: { azione: "inserisci"; dati: DatiInserimentoManuale } | { azione: "scarta" }) => Promise<void>;
  onAnnullaImport: () => void;
  onRiduci: () => void;
  annullamentoInCorso: boolean;
}) {
  const [dati, setDati] = useState<DatiInserimentoManuale>(() => datiDa(riga));
  const [idCanale, setIdCanale] = useState("");
  const [idArea, setIdArea] = useState("");
  const [risultati, setRisultati] = useState<IndirizzoTrovatoDTO[]>([]);
  const [scelto, setScelto] = useState<IndirizzoTrovatoDTO | null>(null);
  const [confermato, setConfermato] = useState<string | null>(null);
  const [coordinateIncollate, setCoordinateIncollate] = useState("");
  const [ricercaInCorso, setRicercaInCorso] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState<"inserisci" | "scarta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const { canali, aree } = useMemo(() => canaliEAree(combinazioni), [combinazioni]);

  // Nuova riga in attesa: si riparte dai dati del file e da canale e area riconosciuti
  useEffect(() => {
    const iniziale = combinazioni.find(c => c.id === riga.dati.id_combinazione_canale_area);
    setDati(datiDa(riga));
    setIdCanale(iniziale?.id_canale ?? riga.idCanale ?? "");
    setIdArea(iniziale?.id_area ?? riga.idArea ?? "");
    setRisultati([]);
    setScelto(null);
    setConfermato(null);
    setCoordinateIncollate("");
    setErrore(null);
  }, [riga, combinazioni]);

  const combinazione = combinazioneDi(combinazioni, idCanale, idArea);
  const completi = { ...dati, guidIDCombinazione: combinazione?.id ?? "" };
  const indirizzoValido = confermato !== null && confermato === chiaveIndirizzo(dati);
  const pronto = inserimentoCompleto(completi, confermato);
  const punti = useMemo(
    () => (scelto ? [[scelto.lat, scelto.lon] as [number, number]] : risultati.map(r => [r.lat, r.lon] as [number, number])),
    [scelto, risultati]
  );

  const campo = (chiave: keyof DatiInserimentoManuale, etichetta: string, classe = "col-span-12 sm:col-span-6") => (
    <div className={classe}>
      <FormLabel htmlFor={`inserimento-${chiave}`}>{etichetta}</FormLabel>
      <FormInput
        id={`inserimento-${chiave}`}
        value={String(dati[chiave] ?? "")}
        onChange={e => setDati(d => ({ ...d, [chiave]: e.target.value }))}
      />
    </div>
  );

  const cerca = async () => {
    setRicercaInCorso(true);
    setErrore(null);
    setScelto(null);
    try {
      const q = [dati.indirizzo, dati.cap, dati.citta, dati.provincia].filter(Boolean).join(", ");
      const risposta = await ServerCall.get<{ risultati: IndirizzoTrovatoDTO[] }>(`/ACPV/geocodifica/cerca?q=${encodeURIComponent(q)}`);
      setRisultati(risposta.risultati);
      if (risposta.risultati.length === 0) setErrore("Nessun indirizzo trovato: correggi via, CAP o città e riprova");
    } catch (e: any) {
      setErrore(e?.message || "Ricerca indirizzi non disponibile");
    } finally {
      setRicercaInCorso(false);
    }
  };

  const scegli = (trovato: IndirizzoTrovatoDTO) => {
    const aggiornati = applicaIndirizzo(dati, trovato);
    setScelto(trovato);
    setDati(aggiornati);
    setConfermato(chiaveIndirizzo(aggiornati));
  };

  // Posizione da Google Maps: l'indirizzo resta quello scritto, le coordinate sono quelle incollate
  const usaCoordinate = () => {
    const coordinate = coordinateDaTesto(coordinateIncollate);
    if (!coordinate) {
      setErrore("Coordinate non valide: incolla \"latitudine, longitudine\" o il link copiato da Google Maps");
      return;
    }
    const trovato: IndirizzoTrovatoDTO = {
      etichetta: `Da Google Maps: ${coordinate.lat}, ${coordinate.lon}`,
      indirizzo: dati.indirizzo,
      ...coordinate,
    };
    const aggiornati = { ...dati, ...coordinate };
    setErrore(null);
    setRisultati([trovato]);
    setScelto(trovato);
    setDati(aggiornati);
    setConfermato(chiaveIndirizzo(aggiornati));
  };

  const decidi = async (azione: "inserisci" | "scarta") => {
    setInvioInCorso(azione);
    setErrore(null);
    try {
      await onDecidi(azione === "inserisci" ? { azione, dati: completi } : { azione });
    } catch (e: any) {
      setErrore(e?.message || "Operazione non riuscita");
    } finally {
      setInvioInCorso(null);
    }
  };

  const occupato = invioInCorso !== null || annullamentoInCorso;

  return (
    <Dialog size="xl" open onClose={onRiduci} staticBackdrop>
      <Dialog.Panel>
        <Dialog.Title>
          Inserimento manuale · riga {riga.riga}
          <span className="ml-auto">
            <StatusBadge tono={classePunteggio(riga.punteggio)} etichetta={`affidabilità ${riga.punteggio}/100`} />
          </span>
        </Dialog.Title>
        <Dialog.Description>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 text-sm">
              <div className="text-xs text-slate-500">L'import è in pausa su questa riga: salva o scarta per proseguire.</div>
              <ul className="mt-1 text-xs text-warning list-disc pl-5">
                {riga.motivi.map(m => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <div className="mt-1 text-xs text-slate-500">
                Nel file: {[riga.letto.meta?.insegna, riga.letto.canale && `canale ${riga.letto.canale}`, riga.letto.area && `area ${riga.letto.area}`, riga.letto.regione, riga.letto.provincia]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
            </div>

            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="inserimento-canale">Canale (insegna)</FormLabel>
              <FormSelect id="inserimento-canale" value={idCanale} onChange={e => setIdCanale(e.target.value)}>
                <option value="">Scegli il canale</option>
                {canali.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="inserimento-area">Area</FormLabel>
              <FormSelect id="inserimento-area" value={idArea} onChange={e => setIdArea(e.target.value)}>
                <option value="">Scegli l'area</option>
                {aree.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </FormSelect>
            </div>
            {idCanale && idArea && !combinazione && (
              <div className="col-span-12 text-xs text-danger">
                Questo canale non ha una combinazione con questa area: creala in Aree e canali, poi riprova.
              </div>
            )}

            {campo("nome", "Nome")}
            {campo("ragioneSociale", "Ragione sociale")}
            {campo("indirizzo", "Via e civico", "col-span-12")}
            {campo("cap", "CAP", "col-span-6 sm:col-span-3")}
            {campo("citta", "Città", "col-span-6 sm:col-span-5")}
            {campo("provincia", "Provincia", "col-span-6 sm:col-span-2")}
            {campo("regione", "Regione", "col-span-6 sm:col-span-2")}
            {campo("telefono", "Telefono")}

            <div className="col-span-12 flex flex-wrap items-center gap-2">
              <Button variant="outline-secondary" disabled={!dati.indirizzo.trim()} loading={ricercaInCorso} onClick={cerca}>
                {!ricercaInCorso && <Lucide icon="Search" aria-hidden="true" className="mr-2 h-4 w-4" />}
                Cerca indirizzo sulla mappa
              </Button>
              {indirizzoValido ? (
                <span className="text-xs text-success flex items-center">
                  <Lucide icon="CheckCircle" aria-hidden="true" className="mr-1 h-4 w-4" /> Indirizzo confermato
                </span>
              ) : (
                <span className="text-xs text-slate-500">Scegli il risultato giusto per confermare l'indirizzo</span>
              )}
            </div>

            <div className="col-span-12">
              <FormLabel htmlFor="inserimento-coordinate">Non trovi la posizione? Incolla le coordinate da Google Maps</FormLabel>
              <div className="flex gap-2">
                <FormInput
                  id="inserimento-coordinate"
                  placeholder="43.8430, 10.5027 oppure il link di Google Maps"
                  value={coordinateIncollate}
                  onChange={e => setCoordinateIncollate(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && coordinateIncollate.trim() && usaCoordinate()}
                />
                <Button variant="outline-secondary" className="whitespace-nowrap" disabled={!coordinateIncollate.trim()} onClick={usaCoordinate}>
                  <Lucide icon="MapPin" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Usa coordinate
                </Button>
              </div>
            </div>

            {risultati.length > 0 && (
              <>
                <div className="col-span-12 lg:col-span-5 max-h-64 overflow-y-auto divide-y divide-slate-200 rounded-control border border-slate-200">
                  {risultati.map(r => (
                    <button
                      key={`${r.lat},${r.lon}`}
                      type="button"
                      className={clsx(
                        "w-full text-left p-2 text-xs hover:bg-slate-50 dark:hover:bg-darkmode-400",
                        scelto === r && "bg-primary/10"
                      )}
                      onClick={() => scegli(r)}
                    >
                      {r.etichetta}
                    </button>
                  ))}
                </div>
                <div className="col-span-12 lg:col-span-7 relative h-64 overflow-hidden rounded-control">
                  <MapContainer center={[41.8719, 12.5674]} zoom={6} scrollWheelZoom={false} className="absolute inset-0">
                    <TileLayer
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      maxZoom={19}
                    />
                    <Inquadra punti={punti} />
                    {(scelto ? [scelto] : risultati).map(r => (
                      <CircleMarker
                        key={`${r.lat},${r.lon}`}
                        center={[r.lat, r.lon]}
                        radius={8}
                        // Esadecimali voluti: opzioni di disegno di Leaflet, non classi Tailwind
                        pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: scelto ? "#16a34a" : "#2563eb", fillOpacity: 0.9 }}
                        eventHandlers={{ click: () => scegli(r) }}
                      >
                        <Tooltip>{r.etichetta}</Tooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </>
            )}

            {errore && (
              <Alert variant="soft-danger" icona="CircleAlert" className="col-span-12">
                {errore}
              </Alert>
            )}
          </div>
        </Dialog.Description>
        <Dialog.Footer>
          {/* Annulla import resta separato a sinistra: interrompe tutto l'import, non solo la riga */}
          <Button variant="outline-secondary" className="sm:mr-auto" disabled={occupato} loading={annullamentoInCorso} onClick={onAnnullaImport}>
            Annulla import
          </Button>
          <Button variant="outline-secondary" onClick={onRiduci}>
            Più tardi
          </Button>
          <Button variant="outline-danger" disabled={occupato} loading={invioInCorso === "scarta"} onClick={() => decidi("scarta")}>
            Scarta riga
          </Button>
          <Button variant="primary" disabled={!pronto || occupato} loading={invioInCorso === "inserisci"} onClick={() => decidi("inserisci")}>
            Salva e prosegui
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}
