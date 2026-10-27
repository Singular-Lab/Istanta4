import { FormInput } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import PageHeader from '@/components/Base/PageHeader';
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
            <>
                <PageHeader title="Tutti i file del kit" indietro={INDIETRO} />
                <PageError motivo="I file del kit non sono stati caricati" onRiprova={() => revalidator.revalidate()} />
            </>
        );
    }

    return (
        <div className="grid grid-cols-12 gap-y-10 gap-x-6">
            <div className="col-span-12">
                <PageHeader title={`Tutti i file per ${kit.titolo}`} indietro={INDIETRO} />
                <div className="mt-3.5">
                    <div className="flex flex-col box box--stacked">
                        <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                            <div className="relative">
                                <Lucide
                                    icon="Search"
                                    aria-hidden="true"
                                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                                />
                                <FormInput
                                    type="text"
                                    value={cerca}
                                    onChange={(e) => setCerca(e.target.value)}
                                    placeholder="Cerca file..."
                                    aria-label="Cerca file"
                                    className="pl-9 sm:w-64 rounded-control"
                                />
                            </div>
                        </div>
                        {fileFiltrati.length === 0 ? (
                            <EmptyState
                                icon={cerca.trim() ? "SearchX" : "FileX"}
                                title="Nessun file"
                                description={
                                    cerca.trim()
                                        ? `Nessun file corrisponde a «${cerca.trim()}»`
                                        : "Il kit non contiene file."
                                }
                                className="py-10 px-5"
                            />
                        ) : (
                            <div className="overflow-x-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 p-5">
                                {fileFiltrati.map((file, indice) => (
                                    <div key={`${file.url_download}-${indice}`} className="w-full p-5 border-slate-300/80 rounded-card">
                                        <div className="overflow-hidden rounded-lg h-36 image-fit before:block before:absolute before:w-full before:h-full before:top-0 before:left-0 before:z-10 before:bg-gradient-to-t before:from-slate-900/90 before:to-black/20">
                                            <img alt={file.nome} className="rounded-md" src={file.url} />
                                            <div className="absolute bottom-0 z-10 w-full px-5 pb-6 text-white">
                                                <span className="block text-lg font-medium truncate">{file.nome}</span>
                                            </div>
                                        </div>
                                        <div className="pt-5">
                                            <div className="flex justify-center items-center">
                                                {/* Link HTML e non di react-router: l'URL va al proxy /olimpo, non a una rotta della SPA */}
                                                <a
                                                    className="flex justify-center items-center text-primary"
                                                    href={file.url_download}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download
                                                >
                                                    <Lucide
                                                        icon="Download"
                                                        aria-hidden="true"
                                                        className="w-4 h-4 stroke-[1.3] mr-1.5"
                                                    />{" "}
                                                    Scarica PDF
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default withSessionCheck(TuttiIVolantini);
