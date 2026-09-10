import Lucide from "@/components/Base/Lucide";
import { Menu, Popover } from "@/components/Base/Headless";
import TinySlider, { TinySliderElement } from "@/components/Base/TinySlider";
import Pagination from "@/components/Base/Pagination";
import { FormInput, FormSelect } from "@/components/Base/Form";
import Tippy from "@/components/Base/Tippy";
import Button from "@/components/Base/Button";
import { useState, useRef, useEffect, useCallback } from "react";
import _ from "lodash";
import Litepicker from "@/components/Base/Litepicker";
import { Link, useLoaderData, useRevalidator } from "react-router-dom";

import { ServerCall } from "../../../lib/server_call";
import withSessionCheck from "@/components/SessionChecker";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/Base/PageHeader";
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

const Volantini: React.FC = () => {
  const maxCap = useRef(4);
  const { files } = useLoaderData() as { files: any[] };
  const [daterange, setDaterange] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const r = useRevalidator();
  const renderFiles = useCallback(() => {
    console.log(files);
    if (!files || files.length === 0) {
      return (
        <EmptyState
          icon="FileSearch"
          title="Nessun volantino disponibile"
          description="Al momento non ci sono volantini attivi. I nuovi volantini appariranno qui non appena saranno disponibili."
          buttonText="Aggiorna"
          onButtonClick={()=>{r.revalidate()}}
        />
      );
    }
    return files.map((fileGroup: FileGroup, index: number) => (
      <div key={index} className="flex flex-col md:flex-row border-dashed border-y">
        <div className="flex flex-col p-5 md:w-1/6 border-dashed border-r text-center md:text-left">
          <div className="text-slate-500 mb-5">
            <div>Area: <span><b>{fileGroup.nomeArea}</b></span></div>
            <div>Canale: <span><b>{fileGroup.nomeCanale}</b></span></div>
            <div>Tipo: <span><b>Volantino</b></span></div>
          </div>
        </div>

        <div className="flex flex-wrap md:w-5/6 p-5">
          {fileGroup.files_field.slice(0, maxCap.current).map((file: File, index_files_field: number) => (
            <div key={index_files_field} className="w-full sm:w-1/2 xl:w-1/4 p-5 border-dashed border-slate-300/80">
              <div className="overflow-hidden rounded-lg h-36 image-fit before:block before:absolute before:w-full before:h-full before:top-0 before:left-0 before:z-10 before:bg-gradient-to-t before:from-slate-900/90 before:to-black/20">
                <img alt={file.nome_file} className="rounded-md" src={file.url} />
                <span className="absolute top-0 z-10 px-2.5 py-1 m-5 text-xs text-white rounded-lg bg-success/80 font-medium border-white/20 border">Nuovo</span>
                <div className="absolute bottom-0 z-10 w-full px-5 pb-6 text-white">
                  <p className="block text-lg font-medium ">{file.nome_file.split(".")[0]}</p>
                  <span className="mt-3 text-xs text-white/80">dal 10 al 21 agosto</span>
                </div>
              </div>
              <div className="pt-5">
                <div className="flex items-center">
                  <a
                    className="flex items-center mr-auto text-primary"
                    href={file.url_download}
                    download
                  >
                    <Lucide
                      icon="Download"
                      className="w-4 h-4 stroke-[1.3] mr-1.5"
                    />{" "}
                    Scarica PDF
                  </a>
                  <a className="flex items-center mr-3" href="#">
                    <Lucide
                      icon="SquareKanban"
                      className="w-4 h-4 stroke-[1.3] mr-1.5"
                    />{" "}
                    Apri referenze
                  </a>
                </div>
              </div>
            </div>
          ))}
          {fileGroup.files_field.length > maxCap.current && (
            <div className="w-full text-center mt-5">
              <Link to={`tutti_i_volantini?kit=${  fileGroup.idKit}`} className="text-primary font-medium">
                Vedi tutti ({fileGroup.files_field.length})
              </Link>
            </div>
          )}
        </div>
      </div>
    ));
  }, [files]);

  useEffect(() => {
    console.log(files);
  }, [files]);

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
          <PageHeader
            title="Promozioni in corso"
            description="Qui troverai tutti i volantini pdf disponibili"
          />
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
            <div className="overflow-hidden">
              {renderFiles()}
            </div>
            {files && files.length > 0 && (
              <div className="flex flex-col-reverse flex-wrap items-center p-5 flex-reverse gap-y-2 sm:flex-row">
                <Pagination className="flex-1 w-full mr-auto sm:w-auto">
                  <Pagination.Link>
                    <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                  </Pagination.Link>
                  <Pagination.Link>
                    <Lucide icon="ChevronLeft" className="w-4 h-4" />
                  </Pagination.Link>
                  <Pagination.Link>...</Pagination.Link>
                  <Pagination.Link>1</Pagination.Link>
                  <Pagination.Link active>2</Pagination.Link>
                  <Pagination.Link>3</Pagination.Link>
                  <Pagination.Link>...</Pagination.Link>
                  <Pagination.Link>
                    <Lucide icon="ChevronRight" className="w-4 h-4" />
                  </Pagination.Link>
                  <Pagination.Link>
                    <Lucide icon="ChevronsRight" className="w-4 h-4" />
                  </Pagination.Link>
                </Pagination>
                <FormSelect className="sm:w-20 rounded-[0.5rem]">
                  <option>10</option>
                  <option>25</option>
                  <option>35</option>
                  <option>50</option>
                </FormSelect>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(Volantini);