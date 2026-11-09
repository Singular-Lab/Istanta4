import Alert from "@/components/Base/Alert";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { useFetchFunzionalita } from "@/query/query";
import {
  eImportGiaInCorso,
  importInCorso,
  useAnnullaImportVendite,
  useAnteprimaImportVendite,
  useAvviaImportVendite,
  useRiepilogoVendite,
  useStatoImportVendite,
} from "@/query/vendite";
import { useEffect, useState } from "react";
import type { CustomError } from "../../../lib/server_call";
import { AnteprimaImport } from "./AnteprimaImport";
import { AvanzamentoImportVendite } from "./AvanzamentoImportVendite";
import { CaricaFileVendite } from "./CaricaFileVendite";
import { eFileVendite } from "./formato";
import { RiepilogoVendite } from "./RiepilogoVendite";

const messaggio = (errore: unknown, ripiego: string) => (errore as Error | null)?.message || ripiego;

/** Le colonne attese, se il server le indica nei dettagli dell'errore di un file non riconosciuto. */
const colonneAtteseDa = (errore: unknown): string[] => {
  const dettagli = (errore as CustomError | null)?.details as Record<string, unknown> | undefined;
  const colonne = dettagli?.colonneAttese ?? dettagli?.colonne;
  return Array.isArray(colonne) ? colonne.filter((c): c is string => typeof c === "string") : [];
};

/**
 * Vendite della GDO (/analisi/vendite, "analisi.importa_vendite"): il riepilogo di cosa c'è e
 * l'import del file del cliente (sell-out per prodotto, punto vendita e periodo). Il file si legge
 * prima in anteprima, senza scrivere; confermato, l'import gira in background e la pagina ne segue
 * l'avanzamento, con la possibilita' di annullarlo. Le vendite alimentano rendimento e previsione
 * dei volantini. Sempre sulla GDO operativa della sessione, anche per Superadmin e Agenzia: la
 * pagina ne mostra il nome e non propone di sceglierne un'altra. "Vendite e previsioni" e' una
 * funzione da attivare per GDO: spenta, la pagina lo dice e non chiede nulla alle API delle vendite.
 */
function Vendite() {
  const funzionalita = useFetchFunzionalita();
  const attiva = funzionalita.data?.vendite === true;
  const riepilogo = useRiepilogoVendite(attiva);
  const stato = useStatoImportVendite(attiva);
  const anteprima = useAnteprimaImportVendite();
  const avvia = useAvviaImportVendite();
  const annulla = useAnnullaImportVendite();
  const nomeGdo = riepilogo.data?.gdo?.nome ?? null;

  const [file, setFile] = useState<File | null>(null);
  const [fileRifiutato, setFileRifiutato] = useState<string | null>(null);
  // L'import seguito da questa pagina: finito, se ne mostra l'esito finche' non lo si chiude
  const [idSeguito, setIdSeguito] = useState<string | null>(null);
  const [giaInCorso, setGiaInCorso] = useState(false);

  const attuale = stato.data ?? null;
  const inCorso = importInCorso(attuale);
  useEffect(() => {
    if (attuale && inCorso) setIdSeguito(attuale.id);
  }, [attuale, inCorso]);
  const mostraAvanzamento = Boolean(attuale && (inCorso || attuale.id === idSeguito));

  const azzeraFile = () => {
    setFile(null);
    setFileRifiutato(null);
    setGiaInCorso(false);
    anteprima.reset();
    avvia.reset();
  };

  const scegliFile = (scelto: File) => {
    if (!eFileVendite(scelto)) {
      azzeraFile();
      setFileRifiutato(scelto.name);
      return;
    }
    setFileRifiutato(null);
    setGiaInCorso(false);
    avvia.reset();
    setFile(scelto);
    anteprima.mutate(scelto);
  };

  const conferma = () => {
    if (!file) return;
    setGiaInCorso(false);
    avvia.mutate(file, {
      onSuccess: avviato => {
        setIdSeguito(avviato.id);
        setFile(null);
        anteprima.reset();
      },
      onError: errore => {
        if (eImportGiaInCorso(errore)) setGiaInCorso(true);
      },
    });
  };

  const colonneAttese = anteprima.isError ? colonneAtteseDa(anteprima.error) : [];

  return (
    <Pagina
      titolo={nomeGdo ? `Vendite · ${nomeGdo}` : "Vendite"}
      descrizione="Il sell-out della GDO per prodotto, punto vendita e periodo, dai file del cliente: alimenta il rendimento dei box e la previsione dei volantini."
    >
      {funzionalita.isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" decorativo /> Caricamento...
        </div>
      ) : !attiva ? (
        <Sezione>
          <EmptyState
            compatta
            icon="ToggleLeft"
            title="Vendite e previsioni non è attiva per questa GDO"
            description="Si attiva in Impostazioni di produzione, Funzionalità. Accesa, qui si importano le vendite del cliente e negli insight dei volantini compaiono rendimento, previsione e simulazione."
          />
        </Sezione>
      ) : (
      <>
          <RiepilogoVendite query={riepilogo} />

          {mostraAvanzamento && attuale && (
            <AvanzamentoImportVendite
              importazione={attuale}
              giaInCorso={giaInCorso}
              onAnnulla={() => annulla.mutate()}
              annullamentoInCorso={annulla.isPending}
              erroreAnnullamento={annulla.isError ? messaggio(annulla.error, "errore del server") : null}
              onChiudi={() => {
                setIdSeguito(null);
                annulla.reset();
              }}
            />
          )}

          <Sezione
            titolo="Importa le vendite"
            icona="FileUp"
            descrizione="Scegli il file del cliente: prima di importarlo ne vedi l'anteprima."
          >
            <div className="flex flex-col gap-4">
              <CaricaFileVendite
                onFile={scegliFile}
                nomeFile={file?.name ?? null}
                disabilitato={anteprima.isPending || avvia.isPending}
              />

              {fileRifiutato && (
                <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-sm">
                  {fileRifiutato} non è un file Excel o CSV: scegli un file .xlsx, .xls o .csv.
                </Alert>
              )}

              {anteprima.isPending && (
                <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner size="sm" decorativo /> Lettura del file in corso...
                </div>
              )}

              {anteprima.isError && (
                <Alert variant="soft-danger" icona="CircleAlert" titolo="File non riconosciuto" className="px-3 py-2 text-sm">
                  <p>{messaggio(anteprima.error, "Il file non si è potuto leggere.")}</p>
                  {colonneAttese.length > 0 && (
                    <p className="mt-1">Colonne attese: {colonneAttese.join(", ")}.</p>
                  )}
                </Alert>
              )}

              {anteprima.data && file && (
                <AnteprimaImport
                  anteprima={anteprima.data}
                  nomeFile={file.name}
                  onConferma={conferma}
                  onAltroFile={azzeraFile}
                  avvioInCorso={avvia.isPending}
                  importInCorso={inCorso}
                />
              )}

              {avvia.isError && !eImportGiaInCorso(avvia.error) && (
                <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-sm">
                  Import non avviato: {messaggio(avvia.error, "errore del server")}
                </Alert>
              )}
            </div>
          </Sezione>
      </>
      )}
    </Pagina>
  );
}

export default withSessionCheck(Vendite);
