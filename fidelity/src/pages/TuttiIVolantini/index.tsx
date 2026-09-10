import Button from '@/components/Base/Button';
import { FormInput, FormSelect } from '@/components/Base/Form';
import { Popover } from '@/components/Base/Headless';
import Litepicker from '@/components/Base/Litepicker';
import Lucide from '@/components/Base/Lucide';
import withSessionCheck from "@/components/SessionChecker";
import React, { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';

const TuttiIVolantini: React.FC = () => {
    const [daterange, setDaterange] = useState("");
    const { kit } = useLoaderData() as { kit: {
        titolo: string;
        files: { nome: string; url: string; url_download: string; }[];
    } };

    useEffect(() => {
        console.log(kit);
    }, [kit]);

    return (
        <div className="grid grid-cols-12 gap-y-10 gap-x-6">
            <div className="col-span-12">
                <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
                    <div className="text-base font-medium group-[.mode--light]:text-white">
                        <h1>Tutti i file per { kit.titolo} </h1>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 md:ml-auto">

                    </div>
                </div>
                <div className="mt-3.5">
                    <div className="flex flex-col box box--stacked">
                        <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                            <div>
                                <div className="relative">
                                    <Lucide
                                        icon="Search"
                                        className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                                    />
                                    <FormInput
                                        type="text"
                                        placeholder="Cerca promozione..."
                                        className="pl-9 sm:w-64 rounded-[0.5rem]"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">


                                <Popover className="inline-block">
                                    {({ close }) => (
                                        <>
                                            <Popover.Button
                                                as={Button}
                                                variant="outline-secondary"
                                                className="w-full sm:w-auto"
                                            >
                                                <Lucide
                                                    icon="ArrowDownWideNarrow"
                                                    className="stroke-[1.3] w-4 h-4 mr-2"
                                                />
                                                Filtra
                                                <div className="flex items-center justify-center h-5 px-1.5 ml-2 text-xs font-medium border rounded-full bg-slate-100">
                                                    X
                                                </div>
                                            </Popover.Button>

                                            <Popover.Panel placement="bottom-end">
                                                <div className="p-2">
                                                    <div>
                                                        <div className="text-left text-slate-500">
                                                            Stato
                                                        </div>
                                                        <FormSelect className="flex-1 mt-2">
                                                            <option value="">Tutte</option>
                                                            <option value="">Attive</option>
                                                            <option value="">Nuove</option>
                                                            <option value="">In arrivo</option>
                                                            <option value="">In scadenza</option>
                                                        </FormSelect>
                                                    </div>
                                                    <div className="mt-3">
                                                        <div className="text-left text-slate-500">
                                                            insegna
                                                        </div>
                                                        <FormSelect className="flex-1 mt-2">
                                                            <option value="">Tutte</option>
                                                            <option value="">DOC</option>
                                                        </FormSelect>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="text-left text-slate-500">
                                                            Area
                                                        </div>
                                                        <FormSelect className="flex-1 mt-2">
                                                            <option value="">Tutte</option>
                                                            <option value="">Roma</option>
                                                        </FormSelect>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="text-left text-slate-500">
                                                            Canale
                                                        </div>
                                                        <FormSelect className="flex-1 mt-2">
                                                            <option value="">Tutti</option>
                                                            <option value="">Market</option>
                                                            <option value="">Oro</option>
                                                            <option value="">Prossimità</option>
                                                        </FormSelect>
                                                    </div>



                                                    <div className="mt-3">
                                                        <div className="text-left text-slate-500">
                                                            Periodo
                                                        </div>
                                                        <div className="flex-1 mt-2">
                                                            <Litepicker value={daterange} onChange={(e) => {
                                                                setDaterange(e.target.value);
                                                            }}
                                                                options={{
                                                                    lang: "it",
                                                                    autoApply: false,
                                                                    singleMode: false,
                                                                    numberOfColumns: 2,
                                                                    numberOfMonths: 2,
                                                                    showWeekNumbers: true,
                                                                    dropdowns: {
                                                                        minYear: 1990,
                                                                        maxYear: null,
                                                                        months: true,
                                                                        years: true,
                                                                    },
                                                                }}
                                                                className="block w-56 mx-auto"
                                                            />
                                                        </div>

                                                    </div>



                                                    <div className="flex items-center mt-4">
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                close();
                                                            }}
                                                            className="w-32 ml-auto"
                                                        >
                                                            Chiudi
                                                        </Button>
                                                        <Button variant="primary" className="w-32 ml-2">
                                                            Filtra
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Popover.Panel>
                                        </>
                                    )}
                                </Popover>
                            </div>
                        </div>
                        <div className="overflow-x-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 p-5">
                            {kit.files.map((file, index_files_field) => (
                            <div key={index_files_field} className="w-full p-5 border-slate-300/80 rounded-md">
                                <div className="overflow-hidden rounded-lg h-36 image-fit before:block before:absolute before:w-full before:h-full before:top-0 before:left-0 before:z-10 before:bg-gradient-to-t before:from-slate-900/90 before:to-black/20">
                                    <img alt={file.nome} className="rounded-md" src={file.url} />
                                    <span className="absolute top-0 z-10 px-2.5 py-1 m-5 text-xs text-white rounded-lg bg-success/80 font-medium border-white/20 border">Nuovo</span>
                                    <div className="absolute bottom-0 z-10 w-full px-5 pb-6 text-white">
                                        <span className="block text-lg font-medium truncate">{file.nome}</span>
                                        <span className="mt-3 text-xs text-white/80">dal 10 al 21 agosto</span>
                                    </div>
                                </div>
                                <div className="pt-5">
                                    <div className="flex justify-center items-center">
                                        <Link
                                            className="flex justify-center items-center text-primary"
                                            to={file.url_download}
                                            target="_blank"
                                            download
                                        >
                                            <Lucide
                                                icon="Download"
                                                className="w-4 h-4 stroke-[1.3] mr-1.5"
                                            />{" "}
                                            Scarica PDF
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default withSessionCheck(TuttiIVolantini);