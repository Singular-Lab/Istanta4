import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ContextMenuItem {
  type: "item" | "checkbox" | "radio" | "label" | "separator" | "sub";
  label?: string;
  shortcut?: string;
  realShortcut?: string;
  checked?: boolean;
  value?: string;
  items?: Array<ContextMenuItem>;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "warning" | "success";
}

interface ContextMenuContextProps {
  menuItems: ContextMenuItem[];
  setMenuItems: (items: ContextMenuItem[]) => void;
}

const ContextMenuContext = createContext<ContextMenuContextProps | undefined>(undefined);

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return context;
};

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [menuItems, setMenuItems] = useState<ContextMenuItem[]>([]);
  return (
    <ContextMenuContext.Provider value={{ menuItems, setMenuItems }}>
      {children}
    </ContextMenuContext.Provider>
  );
};