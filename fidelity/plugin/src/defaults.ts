import type { FPStyles, FPGridStyles, FPCarouselStyles } from './types';

export const DEFAULT_STYLES: Required<Omit<FPStyles, 'responsive'>> & { grid: Required<FPGridStyles>; carousel: Required<FPCarouselStyles> } = {
    gap: '12px',
    scale: 1,
    maxWidth: '100%',
    padding: '16px',
    grid: {
        columns: 'auto-fill',
        minItemWidth: '280px',
        maxItems: 0, // 0 = nessun limite
        itemHeight: 'auto'
    },
    carousel: {
        itemWidth: '280px',
        itemMaxWidth: '400px',
        snapAlign: 'start',
        scrollBehavior: 'smooth',
        transitionDuration: '0.4s',
        indicatorColor: 'rgba(0, 0, 0, 0.3)',
        indicatorActiveColor: 'rgba(0, 0, 0, 0.7)',
        navSize: '40px',
        navBg: 'rgba(255, 255, 255, 0.9)',
        navBgHover: '#fff',
        navColor: 'rgba(0, 0, 0, 0.6)'
    }
};
