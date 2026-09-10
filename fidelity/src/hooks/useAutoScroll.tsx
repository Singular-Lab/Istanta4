// useAutoScroll.tsx
import { useEffect } from 'react';
import { useDragLayer } from 'react-dnd';

import { MutableRefObject } from 'react';

function useAutoScroll(containerRef: MutableRefObject<HTMLDivElement | null>) {
  const { isDragging, clientOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    clientOffset: monitor.getClientOffset(),
  }));

  useEffect(() => {
    if (!isDragging || !clientOffset) {
      return;
    }

    const scrollContainer = containerRef.current;
    if (!scrollContainer) return;

    const handleAutoScroll = () => {
      const rect = scrollContainer.getBoundingClientRect();
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      const y = clientOffset.y - rect.top; // Posizione del cursore rispetto al contenitore

      const DISTANCE_FROM_EDGE = 100; // Distanza dal bordo per iniziare lo scroll
      const ease = (n: number) => Math.pow(n, 3); // Funzione di easing

      // Scroll Up
      if (y < DISTANCE_FROM_EDGE && scrollTop > 0) {
        const rate = ease(1 + (DISTANCE_FROM_EDGE - y) / DISTANCE_FROM_EDGE);
        scrollContainer.scrollTop = scrollTop - rate;
      }
      // Scroll Down
      else if (y > clientHeight - DISTANCE_FROM_EDGE && scrollTop < scrollHeight - clientHeight) {
        const rate = ease(1 + (y - clientHeight + DISTANCE_FROM_EDGE) / DISTANCE_FROM_EDGE);
        scrollContainer.scrollTop = scrollTop + rate;
      }
    };

    let animationFrameId: number;
    const loop = () => {
      handleAutoScroll();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging, clientOffset, containerRef]);
}

export default useAutoScroll;
