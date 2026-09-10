import React, { memo, useCallback, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation, Virtual, Zoom } from 'swiper/modules';
import BoxRef from '@/pages/WebPliant/BoxRef';
import Lucide from '@/components/Base/Lucide';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/virtual';
import 'swiper/css/zoom';
import { Config, ConfigWebpliant, DataFields, ReferenzeIstanta } from '../../../../lib/types';
import clsx from 'clsx';
import styleWp from '@/assets/css/webpliant/stylewp.module.scss';
import {v4 as uuidv4} from 'uuid';
import { Swiper as SwiperType } from 'swiper/types';

// Custom CSS for pagination animation
const paginationStyles = `
  .swiper-pagination-bullet {
    transition: transform 0.3s ease, background-color 0.3s ease;
    opacity: 0.5;
  }
  
  .swiper-pagination-bullet-active {
    transform: scale(1.5);
    opacity: 1;
    background-color: #007aff;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1.2);
      box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7);
    }
    70% {
      transform: scale(1.5);
      box-shadow: 0 0 0 6px rgba(0, 122, 255, 0);
    }
    100% {
      transform: scale(1.2);
      box-shadow: 0 0 0 0 rgba(0, 122, 255, 0);
    }
  }
`;

interface CarouselSwiperProps {
  referenze: ReferenzeIstanta[];
  item: any;
  config: Config;
  refsWishlist?: DataFields[] | null;
}

const CarouselSwiper: React.FC<CarouselSwiperProps> = memo(function CarouselSwiper({
  referenze,
  item,
  config,
  refsWishlist,
}) {
  const [swiperInstance, setSwiperInstance] = useState<SwiperType>();
  const swiperRef = useRef<any>(null);
  
  // Store stable reference to slideIds to prevent unnecessary re-renders
  const slideIds = useRef<string[]>(
    referenze?.map(() => uuidv4()) || []
  ).current;

  const handleNext = useCallback(() => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideNext();
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slidePrev();
    }
  }, []);

  // Custom pagination options with animation class
  const paginationOptions = {
    clickable: true,
    renderBullet: (index: number, className: string) => {
      return `<span class="${className}"></span>`;
    },
  };

  // Insert styles once when component is mounted
  React.useEffect(() => {
    // Create style element for pagination animations
    const styleElement = document.createElement('style');
    styleElement.textContent = paginationStyles;
    document.head.appendChild(styleElement);

    // Clean up on unmount
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className={styleWp["wp-position-relative"]}>
      <Swiper
        onSwiper={(swiper) => {
          setSwiperInstance(swiper);
        }}
        key={item.id}
        modules={[Virtual, Pagination, Navigation, Zoom]}
        // pagination={paginationOptions}
        virtual={true}
        slideBlankClass="swiper-slide-blank"
        spaceBetween={50}
        direction="horizontal"
        id={`carousel_swiper_${  item.id}`}
        className={clsx(styleWp["wp-products-carousel-with-banner"], "swiper-container")}
        style={{ minHeight: '500px' }}
        zoom={true}
        setWrapperSize={true}
        updateOnWindowResize={true}
        breakpoints={{
          320: {
            slidesPerView: 1,
            slidesPerGroup: 1,
            spaceBetween: 14,
          },
          768: {
            slidesPerView: 2,
            slidesPerGroup: 2,
            spaceBetween: 24,
          },
          992: {
            slidesPerView: 3,
            slidesPerGroup: 1,
            spaceBetween: 30,
          },
          1550: {
            slidesPerView: 3,
            slidesPerGroup: 1,
            spaceBetween: 30,
          },
          1600: {
            slidesPerView: 4,
            slidesPerGroup: 1,
            spaceBetween: 30,
          },
        }}
        ref={swiperRef}
      >
        {referenze?.map((referenza, index) => (
          <SwiperSlide key={`slide-${slideIds[index]}`} virtualIndex={index}>
            <BoxRef
              key={`box-${slideIds[index]}`}
              referenza={referenza}
              config={config}
              forzaturaBox={item.content?.options?.forzaturaBox}
              style={referenza.fotoExtra?.some((foto) => foto.tipo === 5) 
                ? {...item.content?.customStyles, backgroundColor:""} 
                : item.content?.customStyles}
              isInWishlist={refsWishlist?.some(
                (ref) => ref.codice_referenza === referenza.dataFields.codice_referenza
              )}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Navigation buttons */}
      <button
        id={`prev_button_swiper_${  item.id}`}
        onClick={handlePrev}
        className={clsx(
          styleWp["wp-products-carousel__prev"],
          styleWp["wp-d-flex"],
          styleWp["wp-align-items-center"],
          styleWp["wp-justify-content-center"],
          styleWp["wp-position-absolute"],
          styleWp["wp-start-0"],
          styleWp["wp-top-50"],
          styleWp["wp-translate-middle-y"]
        )}
        style={{ left: '10px', zIndex: 10 }}
        aria-label="Previous slide"
      >
        <Lucide icon="ChevronLeft" />
      </button>

      <button
        id={`next_button_swiper_${  item.id}`}
        onClick={handleNext}
        className={clsx(
          styleWp["wp-products-carousel__next"],
          styleWp["wp-d-flex"],
          styleWp["wp-align-items-center"],
          styleWp["wp-justify-content-center"],
          styleWp["wp-position-absolute"],
          styleWp["wp-end-0"],
          styleWp["wp-top-50"],
          styleWp["wp-translate-middle-y"]
        )}
        style={{ right: '10px', zIndex: 10 }}
        aria-label="Next slide"
      >
        <Lucide icon="ChevronRight" />
      </button>
    </div>
  );
});

export default CarouselSwiper;