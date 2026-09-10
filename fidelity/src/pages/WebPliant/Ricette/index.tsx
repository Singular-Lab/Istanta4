import React, { useState, useEffect } from 'react';
import { ServerCall } from '../../../../lib/server_call';
import { ScrollRestoration, useLoaderData } from 'react-router-dom';
import BoxRef from '../BoxRef';
import { Swiper } from 'swiper/react';
import { SwiperSlide } from 'swiper/react';
import clsx from 'clsx';
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import styleWp from "@/assets/css/webpliant/stylewp\.module\.scss"
import { Config, FotoRicetta, IngredienteRicettaLunga, IngredienteRicettaCorta, ReferenzeIstanta, Ricette as RicetteType, TIPO_RICETTA } from '../../../../lib/types';
import '../webpliant.css';
import { Navigation } from 'swiper/modules';

const Ricette: React.FC = () => {
    const { ricetta, config, referenzeRicetta } = useLoaderData() as {
        ricetta: RicetteType;
        config: Config;
        referenzeRicetta: ReferenzeIstanta[];
    };

    // Helper function per rendere ingredienti in base al tipo di ricetta
    const renderIngrediente = (ingrediente: IngredienteRicettaCorta | IngredienteRicettaLunga, tipo: TIPO_RICETTA) => {
        if (tipo === TIPO_RICETTA.LUNGA) {
            const ing = ingrediente as IngredienteRicettaLunga;
            return `${ing.nome_prodotto} ${ing.quantita_necessaria} ${ing.unita_misura_peso}`;
        } else {
            const ing = ingrediente as IngredienteRicettaCorta;
            return `${ing.nome_prodotto} ${ing.peso} ${ing.unita_misura_peso}`;
        }
    };

    return (
        <div className='mt-20 w-full'>
            <ScrollRestoration />
            <main>
                <section className={clsx(styleWp["wp-product-single"], styleWp["wp-container"])}>
                    <div className={clsx(styleWp["wp-row"])}>
                        <div className={clsx(styleWp["wp-col-lg-7"])}>
                            <div
                                className={clsx(styleWp["wp-product-single__media"])}
                                data-media-type="vertical-thumbnail"
                            >
                                <div className={clsx(styleWp["wp-product-single__image"])}>
                                    <div className={clsx(styleWp["wp-swiper-container"])}>
                                        <div className={clsx(styleWp["wp-swiper-wrapper"])}>
                                            <div className={clsx(styleWp["wp-swiper-slide"], styleWp["wp-product-single__image-item"])}>
                                                <img
                                                    loading="lazy"
                                                    className="h-auto"
                                                    src={ricetta?.foto_ricetta.find((foto: FotoRicetta) => foto.main)?.url}
                                                    width={674}
                                                    height={674}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="flex overflow-x-auto gap-2 mt-4">
                                                {ricetta?.foto_ricetta.filter((foto: FotoRicetta) => !foto.main).map((foto: FotoRicetta, index: number) => (
                                                    <div key={index} className="flex-shrink-0">
                                                        <img
                                                            loading="lazy"
                                                            className="h-24 w-24 object-cover rounded"
                                                            src={foto.url}
                                                            alt=""
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={clsx(styleWp["wp-swiper-button-prev"])}>
                                            <svg
                                                width={7}
                                                height={11}
                                                viewBox="0 0 7 11"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <use href="#icon_prev_sm" />
                                            </svg>
                                        </div>
                                        <div className={clsx(styleWp["wp-swiper-button-next"])}>
                                            <svg
                                                width={7}
                                                height={11}
                                                viewBox="0 0 7 11"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <use href="#icon_next_sm" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                {/* <div className="product-single__thumbnail">
                                    <div className="swiper-container">
                                        <div className="swiper-wrapper">
                                            <div className="swiper-slide product-single__image-item">
                                                <img
                                                    loading="lazy"
                                                    className="h-auto"
                                                    src="../images/ricette_conad/r3_2.webp"
                                                    width={104}
                                                    height={104}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="swiper-slide product-single__image-item">
                                                <img
                                                    loading="lazy"
                                                    className="h-auto"
                                                    src="../images/ricette_conad/r3_1.webp"
                                                    width={104}
                                                    height={104}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="swiper-slide product-single__image-item">
                                                <img
                                                    loading="lazy"
                                                    className="h-auto"
                                                    src="../images/ricette_conad/r3_3.webp"
                                                    width={104}
                                                    height={104}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="swiper-slide product-single__image-item">
                                                <img
                                                    loading="lazy"
                                                    className="h-auto"
                                                    src="../images/imgrefCNO/97557.png"
                                                    width={104}
                                                    height={104}
                                                    alt=""
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                        </div>
                        <div className={clsx(styleWp["wp-col-lg-5"])}>
                            <h1 className={clsx(styleWp["wp-product-single__name"])}>
                                {ricetta?.titolo}
                            </h1>
                            <div className={clsx(styleWp["wp-product-single__swatches"])}>
                                <label>
                                    <b>Ingredienti (per 4 persone):</b>
                                </label>
                                <p></p>
                                <ul className="list-disc list-inside">
                                    {ricetta?.ingredienti?.map((ingrediente, index: number) => (
                                        <li key={index}>{renderIngrediente(ingrediente, ricetta.tipo)}</li>
                                    ))}
                                </ul>
                                <p />
                                <div className="prose text-sm mb-4">
                                    {ricetta.procedimento}
                                </div>
                            </div>
                            <div className={clsx(styleWp["wp-product-single__swatches"])}>
                                <label>
                                    <b>Vini abbinati:</b>
                                </label>
                                <ul className="list-disc list-inside">
                                    {ricetta.abbinamento_vino && ricetta.abbinamento_vino.vini_abbinati.map((vino: any, index: number) => (
                                        <li key={index}>
                                            <span className="font-medium">
                                                {[
                                                    vino.dataFields.descrizione_uno,
                                                    vino.dataFields.descrizione_due,
                                                    vino.dataFields.descrizione_tre,
                                                    vino.dataFields.descrizione_peso,
                                                ].join(" ")}
                                            </span>
                                            {vino.approfondimento && (
                                                <p className="text-sm mt-1 ml-5">
                                                    {vino.approfondimento?.descrizione}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                    {ricetta.abbinamento_vino && ricetta.abbinamento_vino.vini_abbinati.length === 0 && (
                                        <li className="mb-2">
                                            <span className="font-medium">Nessun vino abbinato</span>
                                        </li>
                                    )}
                                </ul>
                                {ricetta.abbinamento_vino && ricetta.abbinamento_vino.motivazione && (
                                    <p className='text-sm mt-2'>
                                        {ricetta.abbinamento_vino.motivazione}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* <div className="product-single__details-tab">
                        <h3 className="h3 text-center text-uppercase mb-4 pb-xl-2 mb-xl-4">
                        Preparazione
                        </h3>
                        <div className="tab-content">
                            <div
                                className="tab-pane fade show active"
                                id="tab-description"
                                role="tabpanel"
                                aria-labelledby="tab-description-tab"
                            >
                                {ricetta?.preparazione && ricetta?.preparazione?.length > 0 && ricetta?.preparazione.map((step: any, index: number) => (
                                    <div key={index} className="product-single__description">
                                        <h2 className="h5">{step.passaggio}</h2>
                                        <p>{step.testo}</p>
                                    </div>
                                ))}
                            </div>
                            <div
                                className="tab-pane fade"
                                id="tab-additional-info"
                                role="tabpanel"
                                aria-labelledby="tab-additional-info-tab"
                            >
                                <div className="product-single__addtional-info">
                                    <div className="item">
                                        <label className="h6">Calorie</label>
                                        <span>500 Kcal</span>
                                    </div>
                                    <div className="item">
                                        <label className="h6">Proteine</label>
                                        <span>40 g</span>
                                    </div>
                                    <div className="item">
                                        <label className="h6">Grassi</label>
                                        <span>35 g</span>
                                    </div>
                                    <div className="item">
                                        <label className="h6">Carboidrati</label>
                                        <span>4 g</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div> */}
                </section>
                <section className={clsx(styleWp["wp-products-carousel"], styleWp["wp-container"], "mt-4 mb-5")}>
                    <h2 className="h3 text-center text-uppercase mt-4 mb-4 pb-xl-2 mb-xl-4">
                        Prodotti in <strong>Volantino</strong>
                    </h2>
                    <div id="related_products" className="wp-position-relative">
                        <Swiper
                            slidesPerView={4}
                            spaceBetween={30}
                            navigation={{
                                nextEl: '.wp-swiper-button-next',
                                prevEl: '.wp-swiper-button-prev',
                            }}
                            modules={[Navigation]}

                            pagination={false}
                            breakpoints={{
                                0: {
                                    slidesPerView: 1,
                                },
                                576: {
                                    slidesPerView: 2,
                                },
                                768: {
                                    slidesPerView: 3,
                                },
                                992: {
                                    slidesPerView: 4,
                                },
                            }}
                            className="mb-10"
                        >
                            {referenzeRicetta && referenzeRicetta.length > 0 && [
                                ...referenzeRicetta,
                                ...(ricetta.abbinamento_vino?.vini_abbinati || []).map((vino: any) => ({
                                    ...vino,
                                    approfondimento: vino.approfondimento || null
                                }))
                            ].map((ref: ReferenzeIstanta, index: number) => (
                                <SwiperSlide key={index}>
                                    <BoxRef referenza={ref} config={config} />
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                    {/* /.position-relative */}
                </section>
                {/* /.products-carousel container */}
            </main>

        </div>
    );
};

export default Ricette;