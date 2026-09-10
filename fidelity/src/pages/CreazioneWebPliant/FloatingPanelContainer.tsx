import { FloatingPanel } from '@/components/Base/FloatingPanel';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

interface FloatingPanelContainerProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
}

export const FloatingPanelContainer = memo<FloatingPanelContainerProps>(({
  title,
  children,
  onClose,
  initialPosition = { x: 40, y: 100 },
}) => {
  const [position, setPosition] = useState(initialPosition);

  // Memoizza il callback per evitare re-render del FloatingPanel
  const handlePositionChange = useCallback((newPosition: { x: number; y: number }) => {
    setPosition(newPosition);
  }, []);

  // Memoizza le props del FloatingPanel per ottimizzare le performance
  const floatingPanelProps = useMemo(() => ({
    title,
    position,
    onClose,
    onPositionChange: handlePositionChange,
  }), [title, position, onClose, handlePositionChange]);

  return createPortal(
    <FloatingPanel {...floatingPanelProps}>
      {children}
    </FloatingPanel>,
    document.body
  );
});
