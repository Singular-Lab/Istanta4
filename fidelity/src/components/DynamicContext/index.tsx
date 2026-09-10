import * as React from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from "@/components/Base/ContextMenu";
import { useHotkeys } from "react-hotkeys-hook";

interface DynamicContextMenuProps {
  menuItems: Array<MenuItem>;
  children?: React.ReactNode;
}

interface MenuItem {
  type: "item" | "checkbox" | "radio" | "label" | "separator" | "sub";
  label?: string;
  shortcut?: string;
  checked?: boolean;
  value?: string;
  realShortcut?: string;
  items?: Array<MenuItem>;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "warning" | "success";
}

function estraiHotkeys(items: MenuItem[]): Array<{ shortcut: string; onClick: () => void }> {
  const hotkeys: Array<{ shortcut: string; onClick: () => void }> = [];
  items.forEach((item) => {
    if (item.realShortcut && item.realShortcut !== "") {
      hotkeys.push({
        shortcut: item.realShortcut,
        onClick: item.onClick ? item.onClick : () => {},
      });
    }
    if (item.type === "sub" && item.items) {
      hotkeys.push(...estraiHotkeys(item.items));
    }
  });
  return hotkeys;
}

const DynamicContextMenu: React.FC<DynamicContextMenuProps> = ({ menuItems, children }) => {
  // Estrai tutti gli hotkey e le relative callback dai menu e sottomenu
  const hotkeys = React.useMemo(() => estraiHotkeys(menuItems), [menuItems]);

  // Crea un handler unico per gestire tutti gli hotkeys
  const handleHotkeys = React.useCallback((event: KeyboardEvent) => {
    const pressedKey = event.key.toLowerCase();
    const modifiers = [];
    
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    
    const pressedShortcut = [...modifiers, pressedKey].join('+');
    
    // Trova l'hotkey corrispondente e esegui la callback
    const matchedHotkey = hotkeys.find(hotkey => 
      hotkey.shortcut.toLowerCase() === pressedShortcut
    );
    
    if (matchedHotkey) {
      event.preventDefault();
      matchedHotkey.onClick();
    }
  }, [hotkeys]);

  // Registra un singolo hook per gestire tutti gli hotkeys
  useHotkeys(
    '*', // Intercetta tutti i tasti
    handleHotkeys,
    { enableOnFormTags: true, preventDefault: false },
    [handleHotkeys]
  );

  const getClassName = (baseClass: string, variant?: string) => {
    return `${baseClass} ${variant ? `${baseClass}--${variant}` : ""}`;
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    switch (item.type) {
      case "item":
        return (
          <ContextMenuItem
            key={index}
            className={getClassName("ContextMenuItem", item.variant)}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuItem>
        );
      case "checkbox":
        return (
          <ContextMenuCheckboxItem
            key={index}
            className={getClassName("ContextMenuCheckboxItem", item.variant)}
            checked={item.checked}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuCheckboxItem>
        );
      case "radio":
        return (
          <ContextMenuRadioItem
            key={index}
            className={getClassName("ContextMenuRadioItem", item.variant)}
            value={item.value || ""}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuRadioItem>
        );
      case "label":
        return (
          <ContextMenuLabel
            key={index}
            className={getClassName("ContextMenuLabel", item.variant)}
          >
            {item.label}
          </ContextMenuLabel>
        );
      case "separator":
        return (
          <ContextMenuSeparator
            key={index}
            className={getClassName("ContextMenuSeparator", item.variant)}
          />
        );
      case "sub":
        return (
          <ContextMenuSub key={index}>
            <ContextMenuSubTrigger
              className={getClassName("ContextMenuSubTrigger", item.variant)}
              disabled={item.disabled}
            >
              {item.label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="ContextMenuSubContent">
              {item.items?.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        );
      default:
        return null;
    }
  };

  return (
    <ContextMenuContent className="ContextMenuContent">
      {menuItems.map((item, index) => renderMenuItem(item, index))}
      {children}
    </ContextMenuContent>
  );
};

export default DynamicContextMenu;
