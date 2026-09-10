import Lucide from '@/components/Base/Lucide';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VirtualDirectory } from '../../../lib/types';

interface DirectoryPickerProps {
  directories: VirtualDirectory[];
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

const DirectoryNode: React.FC<{
  dir: VirtualDirectory;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}> = ({ dir, depth, selectedPath, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dir.children && dir.children.length > 0;
  const isSelected = selectedPath === dir.path;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : 'hover:bg-slate-100 text-slate-700'
          }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(dir.path)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0 bg-transparent border-none cursor-pointer flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <Lucide
              icon={expanded ? 'ChevronDown' : 'ChevronRight'}
              className="w-3.5 h-3.5 text-slate-400"
            />
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <Lucide
          icon={expanded && hasChildren ? 'FolderOpen' : 'Folder'}
          className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-amber-500'}`}
        />
        <span className="truncate">{dir.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {dir.children!.map((child) => (
            <DirectoryNode
              key={child.path}
              dir={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({
  directories,
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Seleziona directory...'
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const handleSelect = useCallback((path: string) => {
    onChange(path);
    setOpen(false);
  }, [onChange]);

  // Position the dropdown relative to the trigger button
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 300;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 280),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }
      ),
      zIndex: 9999,
    });
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 300;
      const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 280),
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }
        ),
        zIndex: 9999,
      });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectedName = value ? value.split('/').pop() : '';

  const dropdownContent = open ? createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-slate-200 rounded-lg shadow-lg"
    >
      {directories.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          <Lucide icon="FolderX" className="w-8 h-8 mx-auto mb-2 stroke-[1]" />
          Nessuna directory disponibile
        </div>
      ) : (
        <>
          {value && (
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 truncate">{value}</span>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-danger transition-colors"
                onClick={() => { onChange(''); setOpen(false); }}
              >
                Rimuovi
              </button>
            </div>
          )}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {directories.map((dir) => (
              <DirectoryNode
                key={dir.path}
                dir={dir}
                depth={0}
                selectedPath={value}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors ${disabled
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : open
            ? 'border-primary/50 ring-2 ring-primary/20 bg-white'
            : 'border-slate-300 bg-white hover:border-slate-400 cursor-pointer'
          }`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        {loading ? (
          <>
            <Lucide icon="Loader" className="w-4 h-4 animate-spin text-slate-400" />
            <span className="text-slate-400">Caricamento...</span>
          </>
        ) : value ? (
          <>
            <Lucide icon="Folder" className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="truncate text-slate-700">{selectedName}</span>
            <span className="text-[10px] text-slate-400 truncate ml-auto hidden sm:block">{value}</span>
          </>
        ) : (
          <>
            <Lucide icon="FolderSearch" className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-400">{placeholder}</span>
          </>
        )}
        <Lucide icon="ChevronsUpDown" className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-auto" />
      </button>
      {dropdownContent}
    </div>
  );
};

export default DirectoryPicker;
