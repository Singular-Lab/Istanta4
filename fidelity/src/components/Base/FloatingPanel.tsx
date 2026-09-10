import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Lucide from '@/components/Base/Lucide';

interface FloatingPanelProps {
  title: string;
  children: React.ReactNode;
  position: { x: number, y: number };
  onClose: () => void;
  onPositionChange: (pos: { x: number, y: number }) => void;
}

export const FloatingPanel = ({
  title,
  children,
  position,
  onClose,
  onPositionChange
}: FloatingPanelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  
  const handleDragStart = (e: React.MouseEvent) => {
    // Non iniziare il drag del pannello se il click proviene da un elemento draggable
    const target = e.target as HTMLElement;
    if (target.closest('[data-react-dnd-drag-ref]') || target.closest('.react-dnd-draggable')) {
      return;
    }
    
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };
  
  useEffect(() => {
    const handleDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      onPositionChange({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      });
    };
    
    const handleDragEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('mouseleave', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('mouseleave', handleDragEnd);
    };
  }, [isDragging, onPositionChange]);

  return (
    <motion.div
      className="absolute bg-white dark:bg-darkmode-600 rounded-lg shadow-lg border border-slate-200/80 dark:border-darkmode-500/80 z-50 flex flex-col"
      style={{ 
        left: position.x, 
        top: position.y,
        width: '320px'
      }}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div 
        className="flex items-center justify-between p-4 py-2 border-b border-slate-200 dark:border-darkmode-500 cursor-move"
        onMouseDown={handleDragStart}
      >
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-darkmode-500 transition-colors"
        >
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-auto p-2 scrollbar">
        {children}
      </div>
    </motion.div>
  );
}; 