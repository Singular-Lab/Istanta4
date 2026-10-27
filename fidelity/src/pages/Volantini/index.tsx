import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { useMemo, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router-dom";

interface File {
  nome_file: string;
  id_olimpo_cloud: string;
  tipo_export: string;
  codice_tipiexport: string;
  idPromo: string;
  url: string;
  url_download: string;
}
interface FileGroup {
  idKit: string;
  idCanale: string;
  idArea: string;
  nomeArea: string;
  nomeCanale: string;
  files_field: File[];
}

// Volantini mostrati per ogni kit prima del collegamento "Vedi tutti"
const MAX_FILE_PER_KIT = 4;
const KIT_PER_PAGINA = 10;

const valoriUnici = (valori: string[]) => [...new Set(valori.filter(Boolean))].sort((a, b) => a.localeCompare(b));

const Volantini: React.FC = () => {
  const { files } = useLoaderData() as { files: FileGroup[] | null };
  const revalidator = useRevalidator();
  const [ricerca, setRicerca] = useState("");
  const [area, setArea] = useState("");
  const [canale, setCanale] = useState("");
  const [pagina, setPagina] = useState(1);

  const gruppi = useMemo(() => files ?? [], [files]);
  const aree = useMemo(() => valoriUnici(gruppi.map((g) => g.nomeArea)), [gruppi]);
  const canali = useMemo(() => valoriUnici(gruppi.map((g) => g.nomeCanale)), [gruppi]);

  // Ricerca su area, canale e nome dei file; filtri per area e canale presi dai dati
  const filtrati = useMemo(() => {
    const testo = ricerca.trim().toLowerCase();
    return gruppi.filter((gruppo) => {
      if (area && gruppo.nomeArea !== area) return false;
      if (canale && gruppo.nomeCanale !== canale) return false;
      if (!testo) return true;
      return (
        gruppo.nomeArea?.toLowerCase().includes(testo) ||
        gruppo.nomeCanale?.toLowerCase().includes(testo) ||
        gruppo.files_field.some((file) => file.nome_file.toLowerCase().includes(testo))
      );
    });
  }, [gruppi, ricerca, area, canale]);

  const visibili = filtrati.slice((pagina - 1) * KIT_PER_PAGINA, pagina * KIT_PER_PAGINA);

  const cambiaFiltro = (applica: () => void) => {
    applica();
    setPagina(1);
  };

  const azzeraFiltri = () =>
    cambiaFiltro(() => {
      setRicerca("");
      setArea("");
      setCanale("");
    });

  return (
    <Pagina titolo="Volantini" descrizione="Volantini PDF disponibili per area e canale">
      <Sezione senzaPadding aria-label="Elenco dei volantini">
        <BarraFiltri>
          <CampoRicerca
            etichetta="Cerca volantini"
            placeholder="Area, canale o nome del file"
            value={ricerca}
            onChange={(valore) => cambiaFiltro(() => setRicerca(valore))}
          />
          <FormSelect
            formSelectSize="sm"
            aria-label="Area"
            className="sm:w-44"
            value={area}
            onChange={(e) => cambiaFiltro(() => setArea(e.target.value))}
          >
            <option value="">Tutte le aree</option>
            {aree.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            formSelectSize="sm"
            aria-label="Canale"
            className="sm:w-44"
            value={canale}
            onChange={(e) => cambiaFiltro(() => setCanale(e.target.value))}
          >
            <option value="">Tutti i canali</option>
            {canali.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </FormSelect>
        </BarraFiltri>

        {gruppi.length === 0 ? (
          <EmptyState
            compatta
            icon="FileSearch"
            title="Nessun volantino disponibile"
            description="Al momento non ci sono volantini attivi. I nuovi volantini appariranno qui non appena saranno disponibili."
            buttonText="Aggiorna"
            onButtonClick={() => revalidator.revalidate()}
          />
        ) : filtrati.length === 0 ? (
          <EmptyState
            compatta
            icon="SearchX"
            title="Nessun risultato"
            description="Nessun volantino corrisponde alla ricerca o ai filtri scelti."
            buttonText="Azzera filtri"
            buttonIcon="RotateCcw"
            onButtonClick={azzeraFiltri}
          />
        ) : (
          <ul className="flex flex-col gap-4 p-5">
            {visibili.map((gruppo) => (
              <li key={gruppo.idKit} className="rounded-card border border-slate-200 bg-white p-4">
                <h3 className="title-card">
                  {gruppo.nomeArea} · {gruppo.nomeCanale}
                </h3>
                <p className="text-xs text-slate-500">Volantino · {gruppo.files_field.length} file</p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {gruppo.files_field.slice(0, MAX_FILE_PER_KIT).map((file) => (
                    <div key={file.id_olimpo_cloud || file.nome_file} className="flex flex-col gap-3">
                      <div className="h-36 overflow-hidden rounded-control border border-slate-200 bg-slate-100">
                        <img alt="" className="h-full w-full object-cover" src={file.url} loading="lazy" />
                      </div>
                      <p className="truncate text-sm font-medium text-slate-800" title={file.nome_file}>
                        {file.nome_file.split(".")[0]}
                      </p>
                      <Button
                        as="a"
                        href={file.url_download}
                        download
                        size="sm"
                        variant="outline-secondary"
                        className="self-start"
                        aria-label={`Scarica il PDF ${file.nome_file}`}
                      >
                        <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Scarica PDF
                      </Button>
                    </div>
                  ))}
                </div>

                {gruppo.files_field.length > MAX_FILE_PER_KIT && (
                  <Link
                    to={`tutti_i_volantini?kit=${gruppo.idKit}`}
                    className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    Vedi tutti ({gruppo.files_field.length})
                    <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <PaginazioneTabella
          totale={filtrati.length}
          pagina={pagina}
          dimensionePagina={KIT_PER_PAGINA}
          onCambiaPagina={setPagina}
        />
      </Sezione>
    </Pagina>
  );
};

export default withSessionCheck(Volantini);
