import Lucide from "@/components/Base/Lucide";
import { Menu, Popover, Disclosure } from "@/components/Base/Headless";
import TinySlider, { TinySliderElement } from "@/components/Base/TinySlider";
import Pagination from "@/components/Base/Pagination";
import { FormInput, FormSelect } from "@/components/Base/Form";
import Button from "@/components/Base/Button";
import { useState, useRef } from "react";
import _ from "lodash";

import Litepicker from "@/components/Base/Litepicker";
import { AlignCenter } from "lucide-react";

function Main() {
  const [generalReportFilter, setGeneralReportFilter] = useState<string>();
  const sliderRef = useRef<TinySliderElement | null>(null);
  const prevImportantNotes = () => {
    sliderRef.current?.tns.goTo("prev");
  };
  const nextImportantNotes = () => {
    sliderRef.current?.tns.goTo("next");
  };

  const [daterange, setDaterange] = useState("");

  return (
    
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
          <div className="text-base font-medium group-[.mode--light]:text-white">
            <h1>NOME PROMOZIONE </h1>
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
                    placeholder="Cerca prodotti..."
                    className="pl-9 sm:w-64 rounded-[0.5rem]"
                  />
                </div>
              </div>
               
              <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">

                {/*
                <Menu>
                  <Menu.Button
                    as={Button}
                    variant="outline-secondary"
                    className="w-full sm:w-auto"
                  >
                    <Lucide
                      icon="Download"
                      className="stroke-[1.3] w-4 h-4 mr-2"
                    />
                    Export
                    <Lucide
                      icon="ChevronDown"
                      className="stroke-[1.3] w-4 h-4 ml-2"
                    />
                  </Menu.Button>
                  <Menu.Items className="w-40">
                    <Menu.Item>
                      <Lucide icon="FileBarChart" className="w-4 h-4 mr-2" />{" "}
                      PDF
                    </Menu.Item>
                    <Menu.Item>
                      <Lucide icon="FileBarChart" className="w-4 h-4 mr-2" />
                      CSV
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
                */}

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
                              Categoria/reparto
                            </div>
                            <FormSelect className="flex-1 mt-2">
                              <option value="">Ortofrutta</option>
                              <option value="">Macelleria</option>
                              <option value="">Pescheria</option>
                              <option value="">Libero Servizio</option>
                              <option value="">Alimentari</option>
                            </FormSelect>
                          </div>
                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              Speciale
                            </div>
                            <FormSelect className="flex-1 mt-2">
                              <option value="">Carta Socio</option>
                              <option value="">Tema 1</option>
                              <option value="">Tema 2</option>
                              <option value="">Fuori Volantino</option>
                            </FormSelect>
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
              <div className="grid grid-cols-12 px-5 -mx-5 border-dashed border-y">

              <div className="col-span-12 sm:col-span-6 xl:col-span-3 border-dashed border-slate-300/80 [&:nth-child(4n)]:border-r-0 px-5 py-5 [&:nth-last-child(-n+4)]:border-b-0 border-r border-b flex flex-col">
  
              <div className="overflow-hidden rounded-lg IST_center image-contain" >

                    <span className="relative left-0 top-0 z-10 px-2.5 py-1 m-5 text-lg text-white rounded-lg bg-danger/80 font-medium border-white/20 border">Sconto 20%</span>
                    <img alt="" className="rounded-md IST_center" src="/src/assets/images/referenze/2083041.png"/>
                    </div>
                    <div className="pt-5">
                      <div className="flex flex-col gap-3.5 mb-5 pb-5 mt-auto border-b border-dashed border-slate-300/70">
                      <div className="flex items-center">
                          <div className="text-slate-500 IST_txt_uppercase"><b>Descrizione titolo della referenza</b>
                          <br /><span className="IST_txt_lowercase">Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza</span></div>
                      </div>

                      </div>


                      <div className="flex items-center IST_paddingBottom20" >
                      <Disclosure.Group variant="boxed">
                        <Disclosure>
                            <Disclosure.Button>
                            <span className="txt_tile_euro txt_color_red">€</span> <span className="txt_tile_prezzo txt_color_red">3,99</span>
                            </Disclosure.Button>
                            <Disclosure.Panel className="leading-relaxed txt_tile_info_prezzi dark:text-slate-500">
                                Sconto: XX% <br/>
                                invece di 0,00 € <br/>
                                al kg 0,00 € <br/>
                            </Disclosure.Panel>
                        </Disclosure>


                        <Disclosure>
                            <Disclosure.Button>
                                Info Referenza
                            </Disclosure.Button>
                            <Disclosure.Panel className="leading-relaxed text-slate-600 dark:text-slate-500">
                                Tipo: <b>Singola/gruppo/artwork</b> <br/>
                                Codice: <b>xxx</b> <br/>
                                Categoria: <br/>
                                <b>Categoria -   Settore -  Reparto </b><br/>
                                Mastro: <b>nome mastro</b> <br/>
                                Meccanica: <b>nome meccanica</b> <br/>
                            </Disclosure.Panel>
                        </Disclosure>

                        <Disclosure>
                            <Disclosure.Button>
                                Info Immagini
                            </Disclosure.Button>
                            <Disclosure.Panel className="leading-relaxed text-slate-600 dark:text-slate-500">
                                Immagine primaria: <br/>
                                <b>nome_immagine</b> <br/>
                                Immagine secondarie: <br/>
                                <b>nome_immagine, nome_immagine, nome_immagine,</b> <br/>
                                Bollini <br/>
                                <b>nome_immagine</b> <br/>
                                Loghi: <br/>
                                <b>nome_immagine</b> <br/>
                                Immagini ambientate: <br/>
                                <b>nome_immagine</b> <br/>
                            </Disclosure.Panel>
                        </Disclosure>
                        </Disclosure.Group>
                        </div>
                        
                    <hr className="IST_paddingBottom20"/>

                      <div className="flex items-center">
                        <a
                          className="flex items-center mr-auto text-primary"
                          href="#"
                        >
                          <Lucide
                            icon="CirclePlus"
                            className="w-4 h-4 stroke-[1.3] mr-1.5"
                          />{" "}
                          Apri scheda referenza
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-6 xl:col-span-3 border-dashed border-slate-300/80 [&:nth-child(4n)]:border-r-0 px-5 py-5 [&:nth-last-child(-n+4)]:border-b-0 border-r border-b flex flex-col">
  
  <div className="overflow-hidden rounded-lg IST_center image-contain" >

        <span className="relative left-0 top-0 z-10 px-2.5 py-1 m-5 text-lg text-white rounded-lg bg-danger/80 font-medium border-white/20 border">Sconto 20%</span>
        <img alt="" className="rounded-md IST_center" src="/src/assets/images/referenze/1200300.jpg"/>
        </div>
        <div className="pt-5">
          <div className="flex flex-col gap-3.5 mb-5 pb-5 mt-auto border-b border-dashed border-slate-300/70">
          <div className="flex items-center">
              <div className="text-slate-500 IST_txt_uppercase"><b>Descrizione titolo della referenza</b>
              <br /><span className="IST_txt_lowercase">Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza Descrizione tipo e grammatura della referenza</span></div>
          </div>

          </div>


          <div className="flex items-center IST_paddingBottom20" >
          <Disclosure.Group variant="boxed">
            <Disclosure>
                <Disclosure.Button>
                <span className="txt_tile_euro txt_color_red">€</span> <span className="txt_tile_prezzo txt_color_red">3,99</span>
                </Disclosure.Button>
                <Disclosure.Panel className="leading-relaxed txt_tile_info_prezzi dark:text-slate-500">
                    Sconto: XX% <br/>
                    invece di 0,00 € <br/>
                    al kg 0,00 € <br/>
                </Disclosure.Panel>
            </Disclosure>


            <Disclosure>
                <Disclosure.Button>
                    Info Referenza
                </Disclosure.Button>
                <Disclosure.Panel className="leading-relaxed text-slate-600 dark:text-slate-500">
                    Tipo: <b>Singola/gruppo/artwork</b> <br/>
                    Codice: <b>xxx</b> <br/>
                    Categoria: <br/>
                    <b>Categoria -   Settore -  Reparto </b><br/>
                    Mastro: <b>nome mastro</b> <br/>
                    Meccanica: <b>nome meccanica</b> <br/>
                </Disclosure.Panel>
            </Disclosure>

            <Disclosure>
                <Disclosure.Button>
                    Info Immagini
                </Disclosure.Button>
                <Disclosure.Panel className="leading-relaxed text-slate-600 dark:text-slate-500">
                    Immagine primaria: <br/>
                    <b>nome_immagine</b> <br/>
                    Immagine secondarie: <br/>
                    <b>nome_immagine, nome_immagine, nome_immagine,</b> <br/>
                    Bollini <br/>
                    <b>nome_immagine</b> <br/>
                    Loghi: <br/>
                    <b>nome_immagine</b> <br/>
                    Immagini ambientate: <br/>
                    <b>nome_immagine</b> <br/>
                </Disclosure.Panel>
            </Disclosure>
            </Disclosure.Group>
            </div>
            
        <hr className="IST_paddingBottom20"/>

          <div className="flex items-center">
            <a
              className="flex items-center mr-auto text-primary"
              href="#"
            >
              <Lucide
                icon="CirclePlus"
                className="w-4 h-4 stroke-[1.3] mr-1.5"
              />{" "}
              Apri scheda referenza
            </a>
          </div>
        </div>
      </div>


              
              </div>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;
