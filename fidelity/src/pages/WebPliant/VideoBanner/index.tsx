// components/VideoBanner.tsx

import styleWp from '@/assets/css/webpliant/stylewp\.module\.scss';
import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

interface VideoBannerProps {
  src: string;
  item: any;
}

const VideoBanner: React.FC<VideoBannerProps> = memo(function VideoBanner({ src, item }) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying((prev) => !prev);
    }
  }, [isPlaying]);

  const keepControlsVisible = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowControls(true);
  }, []);

  const hideControlsAfterDelay = useCallback(() => {
    timeoutRef.current = setTimeout(() => setShowControls(false), 1000);
  }, []);

  const handleInteraction = useCallback(() => {
    keepControlsVisible();
    hideControlsAfterDelay();
  }, [keepControlsVisible, hideControlsAfterDelay]);

  const isMobileFunc = useCallback(() => {
    if (window.innerWidth <= item.content?.widthBreakPoint) {
      setIsMobile(true);
    } else {
      setIsMobile(false);
    }
  }, [item.content?.widthBreakPoint]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.addEventListener('ended', () => {
        setIsPlaying(false);
      });
    }
    window.addEventListener('resize', isMobileFunc);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (videoEl) {
        videoEl.removeEventListener('ended', () => {
          setIsPlaying(false);
        });
      }
      window.removeEventListener('resize', isMobileFunc);
    };
  }, [isMobileFunc]);

  useEffect(() => {
    isMobileFunc();
  }, [isMobileFunc]);

  return (
    <section
      key={item.id}
      className={clsx(styleWp["wp-video-banner"], styleWp["wp-position-relative"])}
      onMouseMove={keepControlsVisible}
      onMouseLeave={hideControlsAfterDelay}
      onTouchStart={handleInteraction}
    >
      <div className={styleWp["wp-video-banner__overlay"]}>
        <motion.div
          className={clsx(
            styleWp["wp-video-banner__controls"],
            styleWp["wp-position-absolute"],
            "top-0",
            styleWp["wp-start-0"],
            "w-full",
            "h-full",
            styleWp["wp-d-flex"],
            styleWp["wp-justify-content-center"],
            styleWp["wp-align-items-center"],
            "z-[1]"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={clsx(
              styleWp["wp-video-banner__play-pause"],
              "bg-white",
              "text-black",
              "rounded-full",
              "p-3",
              "shadow-lg",
              "hover:bg-opacity-90",
              "transition"
            )}
            onMouseEnter={keepControlsVisible}
            onMouseLeave={hideControlsAfterDelay}
            onTouchStart={keepControlsVisible}
          >
            {isPlaying ? <Lucide icon="Pause" /> : <Lucide icon="Play" />}
          </button>
        </motion.div>
      </div>
      <div
        style={{
          background: isMobile
            ? item.content.thumbnailSrcMobile
              ? `url(${item.content?.thumbnailSrcMobile})`
              : 'url(https://placehold.co/300)'
            : item.content?.thumbnailSrcDesktop
              ? `url(${item.content?.thumbnailSrcDesktop})`
              : 'url(https://placehold.co/300)',
        }}
      >
        <video
          preload="metadata"
          ref={videoRef}
          poster={
            isMobile
              ? item.content?.thumbnailSrcMobile
                ? item.content?.thumbnailSrcMobile
                : 'https://placehold.co/300'
              : item.content?.thumbnailSrcDesktop
                ? item.content?.thumbnailSrcDesktop
                : 'https://placehold.co/300'
          }
          id="video_banner_1"
          className={styleWp["wp-bg-video"]}
          src={isMobile ? item.content?.srcMobile : item.content?.srcDesktop}
          onLoadedData={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }
          }}
          onError={(e) => console.error('Error loading video:', e)}
        >
          <track kind="captions" src="" srcLang="it" label="captions_italia" />
          <source src={src} type="video/mp4" />
        </video>
      </div>
    </section>
  );
});

export default VideoBanner;
