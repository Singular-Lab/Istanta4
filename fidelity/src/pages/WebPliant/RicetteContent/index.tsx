// components/RicetteContent.tsx

import styleWp from "@/assets/css/webpliant/stylewp\.module\.scss";
import { useFetchAllRicette } from '@/query/query';
import clsx from 'clsx';
import React, { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import 'swiper/css';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { PageLayoutItem, Ricette } from '../../../../lib/types';



interface RicetteContentProps {
  item: PageLayoutItem
}

const RicetteContent: React.FC<RicetteContentProps> = memo(function RicetteContent({ item }) {
  const urlParams = new URLSearchParams(window.location.search);
  const allParamsString = Array.from(urlParams.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const ricetteQueryResult = useFetchAllRicette();
  const AllRicette = ricetteQueryResult?.data || [];

  const renderRicette = useCallback(() => {
    const ricette = item.content?.ricettaAI || [];
    console.log(ricette);
    // Filtra le ricette in base a dataScadenza di TUTTE le referenze
    return ricette.map((ricetta: Ricette, index: number) => {
      if (ricetta.guid_id !== "") {
        if (!AllRicette) return null;
        if (AllRicette?.find((v) => v.guid_id === ricetta.guid_id)) {
          const foundRicetta = AllRicette?.find((v) => v.guid_id === ricetta.guid_id) as Ricette;
          return (
            <SwiperSlide key={index}>
              <div
                key={index}
                className={clsx(styleWp["wp-blog-grid__item"], "mb-4")}
                style={{ width: 450, marginRight: 30 }}
              >
                <div className={styleWp["wp-blog-grid__item-image"]}>
                  <Link
                    style={{ fontSize: "1.125rem" }}
                    aria-label={`Link pagina ricetta ${foundRicetta.titolo}`}
                    to={`ricetta?id=${foundRicetta.guid_id}`}
                  >
                    <img
                      loading="lazy"
                      className="h-auto"
                      src={`${foundRicetta.foto_ricetta.find((v) => v.main === true)?.url}`}
                      alt=""
                    />
                  </Link>
                </div>
                <div className={styleWp["wp-blog-grid__item-detail"]}>
                  <div className={clsx(styleWp["wp-blog-grid__item-title"], "mb-0")}>
                    <Link
                      style={{ fontSize: "1.125rem" }}
                      aria-label={`Link pagina ricetta ${foundRicetta.titolo}`}
                      to={`ricetta?id=${foundRicetta.guid_id}`}
                    >
                      {foundRicetta.titolo}
                    </Link>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          );
        }
      }
      return null;
    });
  }, [item?.content?.ricettaAI, allParamsString, AllRicette]);

  return (
    <section key={item.id} className={clsx(styleWp["wp-blog-carousel"], styleWp["wp-container"], "my-10")}>
      <div className={styleWp["wp-blog-grid__items"]}>
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          slidesPerView={4}
          slidesPerGroup={4}
          loop
          pagination={{
            el: '.blog-pagination',
            type: 'bullets',
            clickable: true,
          }}
          breakpoints={{
            320: {
              slidesPerView: 1,
              slidesPerGroup: 1,
              spaceBetween: 14,
              pagination: true,
            },
            768: {
              slidesPerView: 2,
              slidesPerGroup: 2,
              spaceBetween: 24,
              pagination: true,
            },
            1400: {
              slidesPerView: 3,
              slidesPerGroup: 1,
              spaceBetween: 10,
              pagination: true,
            },
          }}
          spaceBetween={50}
          direction="horizontal"
          className={clsx(styleWp["wp-blog-grid"], "rounded-sm")}
        >
          {renderRicette()}
        </Swiper>
        <div
          className={clsx(
            styleWp["wp-blog-pagination"],
            styleWp["wp-type2"],
            "mt-1",
            styleWp["wp-mt-md-4"],
            styleWp["wp-d-flex"],
            styleWp["wp-align-items-center"],
            styleWp["wp-justify-content-center"],
            "swiper-pagination-clickable",
            "swiper-pagination-bullets"
          )}
        ></div>
      </div>
    </section>
  );
});

export default RicetteContent;
