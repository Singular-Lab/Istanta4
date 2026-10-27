import BarraFiltri from '@/components/Base/BarraFiltri';
import Button from '@/components/Base/Button';
import CampoRicerca from '@/components/Base/CampoRicerca';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import EmptyState from '@/components/EmptyState';
import withSessionCheck from "@/components/SessionChecker";
import React, { useMemo, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';

type FileKit = {
    nome: string;
    nome_originale?: string;
    url: string;
    url_download: string;
};

const INDIETRO = { to: "/volantini", etichetta: "Torna ai volantini" };

const TuttiIVolantini: React.FC = () => {
    // Il loader restituisce kit null se il servizio non risponde
    const { kit } = useLoaderData() as { kit: { titolo: string; files: FileKit[] } | null };
    const revalidator = useRevalidator();
    const [cerca, setCerca] = useState("");

    // /getAllFiles restituisce tutti i file del kit, pochi e senza parametri di ricerca: si filtra qui
    const fileFiltrati = useMemo(() => {
        const files = kit?.files ?? [];
        const testo = cerca.trim().toLowerCase();
        if (!testo) {
            return files;
        }
        return files.filter((file) =>
            [file.nome, file.nome_originale].some((valore) => valore?.toLowerCase().includes(testo))
        );
    }, [kit, cerca]);

    if (!kit) {
        return (
            <Pagina titolo="Tutti i file del kit" indietro={INDIETRO}>
                <PageError
                    compatta
                    titolo="File non caricati"
                    motivo="I file del kit non sono stati caricati"
                    onRiprova={() => revalidator.revalidate()}
                />
            </Pagina>
        );
    }

    return (
        <Pagina titolo={`Tutti i file per ${kit.titolo}`} indietro={INDIETRO}>
            <Sezione senzaPadding aria-label="File del kit">
                <BarraFiltri>
                    <CampoRicerca etichetta="Cerca file" placeholder="Cerca file…" value={cerca} onChange={setCerca} />
                </BarraFiltri>
                {fileFiltrati.length === 0 ? (
                    <EmptyState
                        compatta
                        icon={cerca.trim() ? "SearchX" : "FileX"}
                        title="Nessun file"
                        description={
                            cerca.trim()
                                ? `Nessun file corrisponde a «${cerca.trim()}»`
                                : "Il kit non contiene file."
                        }
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {fileFiltrati.map((file, indice) => (
                            <li
                                key={`${file.url_download}-${indice}`}
                                className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4"
                            >
                                <div className="h-36 overflow-hidden rounded-control border border-slate-200 bg-slate-100">
                                    <img alt="" className="h-full w-full object-cover" src={file.url} loading="lazy" />
                                </div>
                                <p className="truncate text-sm font-medium text-slate-800" title={file.nome}>
                                    {file.nome}
                                </p>
                                {/* Link HTML e non di react-router: l'URL va al proxy /olimpo, non a una rotta della SPA */}
                                <Button
                                    as="a"
                                    href={file.url_download}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    size="sm"
                                    variant="outline-secondary"
                                    className="self-start"
                                >
                                    <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                    Scarica PDF
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </Sezione>
        </Pagina>
    );
};

export default withSessionCheck(TuttiIVolantini);
