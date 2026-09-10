import Popover from '@/components/Base/Headless/Popover';
import Lucide from '@/components/Base/Lucide';
import { $toggleLink } from '@lexical/link';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { $createHeadingNode, $createQuoteNode, $isQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import clsx from 'clsx';
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND
} from 'lexical';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import stylePluginToolbar from "./plugin_toolbar.module.scss";

const LowPriority = 1;

// Funzione per convertire RGB in HEX
function rgbToHex(rgb: string): string {
  // Gestisce formati come "rgb(255, 255, 255)" o "rgba(255, 255, 255, 1)"
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return '#000000'; // fallback
}

function Divider() {
  return <div className={stylePluginToolbar["divider"]} />;
}

// Componente ColorPicker avanzato con spettro completo
function ColorPicker({
  currentColor,
  onChange,
  label,
}: {
  currentColor: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const [hexColor, setHexColor] = useState(currentColor);

  // Colori predefiniti comuni (solo HEX)
  const presetColors = [
    '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
    '#ff0000', '#ff6600', '#ffcc00', '#00ff00', '#0066ff', '#6600ff',
    '#ff0066', '#00ffff', '#ffff00', '#ff00ff', '#00ff66', '#66ff00',
    '#ffffff' // invece di 'transparent' usiamo bianco
  ];

  // Inizializza il colore corrente
  useEffect(() => {
    setHexColor(currentColor);
  }, [currentColor]);

  const handleColorChange = (color: string) => {
    // Assicuriamoci che sia sempre un HEX valido
    if (color.startsWith('#')) {
      setHexColor(color);
      onChange(color);
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexColor(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(value);
    }
  };

  const applyColor = () => {
    onChange(hexColor);
  };

  return (
    <Popover>
      <Popover.Button
        as="button"
        className={clsx(stylePluginToolbar["toolbar-item"])}
        aria-label={label}
      >
        <div
          style={{
            backgroundColor: currentColor.startsWith('#') ? currentColor : '#000000',
            width: '20px',
            height: '20px',
            border: '1px solid #ccc',
            borderRadius: '2px',
          }}
        />
      </Popover.Button>

      <Popover.Panel placement="bottom" className="w-64 z-[9999]">
        <div className="space-y-3 p-3">
          {/* Colori predefiniti */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-1">Colori comuni</h4>
            <div className="grid grid-cols-8 gap-1">
              {presetColors.map((color) => (
                <button type="button"
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-5 h-5 border border-gray-300 rounded hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: color,
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Input HEX diretto */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-1">Colore personalizzato</h4>

            {/* Anteprima colore e input HEX */}
            <div className="flex items-center space-x-2 mb-2">
              <div
                className="w-8 h-8 border border-gray-300 rounded"
                style={{ backgroundColor: hexColor }}
              />
              <input
                type="text"
                value={hexColor}
                onChange={handleHexInputChange}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                placeholder="#000000"
              />
            </div>

            {/* Pulsante applica */}
            <div className="mt-2">
              <button type="button"
                onClick={applyColor}
                className="w-full px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      </Popover.Panel>
    </Popover>
  );
}

const fontSizeOptions = [
  '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px',
  '32px', '36px', '40px', '48px', '56px', '64px', '72px', '96px'
];

const blockTypeToBlockName = {
  paragraph: 'Normal',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  quote: 'Quote',
  bullet: 'Bulleted List',
  number: 'Numbered List',
};

// Block Format Dropdown
function BlockFormatDropDown({
  editor,
  blockType,
  disabled = false,
}: {
  editor: any;
  blockType: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      $setBlocksType(selection, () => $createParagraphNode());
    });
    setIsOpen(false);
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection();
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      });
    }
    setIsOpen(false);
  };

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        $setBlocksType(selection, () => $createQuoteNode());
      });
    }
    setIsOpen(false);
  };



  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button type="button"
        disabled={disabled}
        className={clsx(stylePluginToolbar["toolbar-item"], "min-w-[100px] text-left")}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Formatting options for text style"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="text-sm">
          {blockTypeToBlockName[blockType as keyof typeof blockTypeToBlockName] || 'Normal'}
        </span>
        <i className="ml-2">▼</i>
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-48 origin-top-right bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 rounded-md">
          <div className="py-1">
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-sm hover:bg-gray-100"
              onClick={formatParagraph}
            >
              Normal
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-lg font-bold hover:bg-gray-100"
              onClick={() => formatHeading('h1')}
            >
              Heading 1
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-base font-bold hover:bg-gray-100"
              onClick={() => formatHeading('h2')}
            >
              Heading 2
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-sm font-bold hover:bg-gray-100"
              onClick={() => formatHeading('h3')}
            >
              Heading 3
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-sm font-semibold hover:bg-gray-100"
              onClick={() => formatHeading('h4')}
            >
              Heading 4
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-xs font-semibold hover:bg-gray-100"
              onClick={() => formatHeading('h5')}
            >
              Heading 5
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-xs font-medium hover:bg-gray-100"
              onClick={() => formatHeading('h6')}
            >
              Heading 6
            </button>
            <button type="button"
              className="flex w-full items-center px-4 py-2 text-sm italic border-l-4 border-gray-300 bg-gray-50 hover:bg-gray-100"
              onClick={formatQuote}
            >
              Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState('16px');
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // Stato per la gestione del form di inserimento link
  const [isLinkFormVisible, setIsLinkFormVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // Stato per la gestione delle tabelle
  const [showTableOptions, setShowTableOptions] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // Adattamento della toolbar per dispositivi mobili
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        const toolbarEl = toolbarRef.current;
        if (toolbarEl) {
          toolbarEl.classList.add(stylePluginToolbar["mobileToolbar"]);
        }
      } else {
        const toolbarEl = toolbarRef.current;
        if (toolbarEl) {
          toolbarEl.classList.remove(stylePluginToolbar["mobileToolbar"]);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Allinea il placeholder dell'editor
  useEffect(() => {
    const editorEl = document.querySelector('.editor-container');
    if (editorEl) {
      const placeholderEl = editorEl.querySelector('.editor-placeholder');
      if (placeholderEl) {
        placeholderEl.classList.add('aligned-placeholder');
      }
    }
  }, []);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Aggiorna gli stati di formattazione
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));

      // Aggiorna colori e font size

      const colorMatch = selection.style.match(/color:\s*([^;]+)/);
      let detectedTextColor = colorMatch ? colorMatch[1].trim() : '#000000';
      // Converti in HEX se necessario
      if (detectedTextColor.startsWith('rgb')) {
        detectedTextColor = rgbToHex(detectedTextColor);
      }
      // Assicuriamoci che sia un HEX valido
      if (!detectedTextColor.startsWith('#')) {
        detectedTextColor = '#000000';
      }
      setTextColor(detectedTextColor);

      const bgColorMatch = selection.style.match(/background-color:\s*([^;]+)/);
      let detectedBgColor = bgColorMatch ? bgColorMatch[1].trim() : '#ffffff';
      // Converti in HEX se necessario
      if (detectedBgColor.startsWith('rgb')) {
        detectedBgColor = rgbToHex(detectedBgColor);
      }
      // Assicuriamoci che sia un HEX valido
      if (!detectedBgColor.startsWith('#')) {
        detectedBgColor = '#ffffff';
      }
      setBgColor(detectedBgColor);

      const fontSizeMatch = selection.style.match(/font-size:\s*([^;]+)/);
      setFontSize(fontSizeMatch ? fontSizeMatch[1].trim() : '16px');

      // Aggiorna il tipo di blocco
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        if (element.__type === 'heading') {
          setBlockType((element as any).__tag);
        } else if ($isQuoteNode(element)) {
          setBlockType('quote');
        } else {
          const type = element.__type;
          if (type in blockTypeToBlockName) {
            setBlockType(type);
          } else {
            setBlockType('paragraph');
          }
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority,
      ),
    );
  }, [editor, updateToolbar]);

  const applyStyleText = (styles: Record<string, string>): void => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, styles);
      }
    });
  };

  const handleTextColorChange = (color: string): void => {
    setTextColor(color);
    applyStyleText({ color });
  };

  const handleBgColorChange = (color: string): void => {
    setBgColor(color);
    applyStyleText({ 'background-color': color });
  };

  const handleFontSizeChange = (size: string): void => {
    setFontSize(size);
    applyStyleText({ 'font-size': size });
  };



  // Gestione del form per inserire un link
  const handleShowLinkForm = () => {
    setLinkUrl('');
    setLinkTitle('');
    setIsLinkFormVisible(true);
  };

  const handleLinkSubmit = () => {
    if (!linkUrl) {
      setIsLinkFormVisible(false);
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (!selection.isCollapsed()) {
          $toggleLink(linkUrl, { title: linkTitle, target: '_blank' });
        } else {
          const textNode = $createTextNode(linkUrl);
          selection.insertNodes([textNode]);
          $toggleLink(linkUrl, { title: linkTitle, target: '_blank' });
        }
      }
    });
    setIsLinkFormVisible(false);
  };

  const handleLinkCancel = () => {
    setIsLinkFormVisible(false);
  };

  // Gestione delle tabelle
  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: tableCols.toString(),
      rows: tableRows.toString(),
    });
    setShowTableOptions(false);
  };

  // Clear formatting
  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Rimuovi ogni formato attivo usando il toggle command
        const formatsToRemove = [
          'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript',
        ] as const;
        for (const fmt of formatsToRemove) {
          if (selection.hasFormat(fmt)) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, fmt);
          }
        }
        // Rimuovi tutti gli stili inline
        $patchStyleText(selection, {
          'color': '',
          'background-color': '',
          'font-size': '',
          'font-family': '',
          'font-weight': '',
          'font-style': '',
          'text-decoration': '',
        });
      }
    });
  };

  const toggleToolbar = () => {
    setIsToolbarVisible(!isToolbarVisible);
  };

  return (
    <div className={stylePluginToolbar["toolbar-container"]}>
      {/* Pulsante toggle per dispositivi mobili */}
      <button type="button"
        className={clsx(stylePluginToolbar["toolbar-toggle"], " md:hidden flex items-center justify-center p-2 bg-gray-100 w-full")}
        onClick={toggleToolbar}
      >
        {isToolbarVisible ? 'Nascondi formattazione' : 'Mostra formattazione'}
      </button>

      {/* Toolbar con visualizzazione condizionale */}
      {isToolbarVisible && (
        <div
          className={clsx(
            stylePluginToolbar["toolbar"],
            "flex flex-wrap overflow-x-auto border-b",
            { "flex": isToolbarVisible, "hidden md:flex": !isToolbarVisible }
          )}
          style={{ position: 'relative' }}
          ref={toolbarRef}
        >
          {/* Undo/Redo */}
          <button type="button"
            disabled={!canUndo}
            onClick={() => {
              editor.dispatchCommand(UNDO_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Undo"
            title="Annulla"
          >
            <Lucide icon="Undo" className="w-4 h-4" />
          </button>
          <button type="button"
            disabled={!canRedo}
            onClick={() => {
              editor.dispatchCommand(REDO_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"])}
            aria-label="Redo"
            title="Ripeti"
          >
            <Lucide icon="Redo" className="w-4 h-4" />
          </button>
          <Divider />

          {/* Block Format Dropdown */}
          <BlockFormatDropDown
            editor={editor}
            blockType={blockType}
          />
          <Divider />

          {/* Text Formatting */}
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isBold })}
            aria-label="Format Bold"
            title="Grassetto"
          >
            <Lucide icon="Bold" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isItalic })}
            aria-label="Format Italics"
            title="Corsivo"
          >
            <Lucide icon="Italic" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isUnderline })}
            aria-label="Format Underline"
            title="Sottolineato"
          >
            <Lucide icon="Underline" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isStrikethrough })}
            aria-label="Format Strikethrough"
            title="Barrato"
          >
            <Lucide icon="Strikethrough" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isSubscript })}
            aria-label="Format Subscript"
            title="Pedice"
          >
            X₂
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"], { "active": isSuperscript })}
            aria-label="Format Superscript"
            title="Apice"
          >
            X²
          </button>
          <Divider />

          {/* Alignment */}
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Left Align"
            title="Allinea a sinistra"
          >
            <Lucide icon="TextAlignStart" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Center Align"
            title="Centra"
          >
            <Lucide icon="TextAlignCenter" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Right Align"
            title="Allinea a destra"
          >
            <Lucide icon="TextAlignEnd" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
            }}
            className={clsx(stylePluginToolbar["toolbar-item"])}
            aria-label="Justify Align"
            title="Giustifica"
          >
            <Lucide icon="TextAlignJustify" className="w-4 h-4" />
          </button>
          <Divider />

          {/* Lists */}
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Bulleted List"
            title="Lista puntata"
          >
            <Lucide icon="List" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Numbered List"
            title="Lista numerata"
          >
            <Lucide icon="ListOrdered" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Indent"
            title="Aumenta rientro"
          >
            <Lucide icon="ListIndentIncrease" className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"])}
            aria-label="Outdent"
            title="Diminuisci rientro"
          >
            <Lucide icon="ListIndentDecrease" className="w-4 h-4" />
          </button>
          <Divider />

          {/* Colors */}
          <ColorPicker
            currentColor={textColor}
            onChange={handleTextColorChange}
            label="Colore testo"
          />
          <ColorPicker
            currentColor={bgColor}
            onChange={handleBgColorChange}
            label="Evidenzia testo"
          />
          <Divider />

          {/* Font Size */}
          <select
            onChange={(e) => handleFontSizeChange(e.target.value)}
            value={fontSize}
            className={clsx(stylePluginToolbar["toolbar-item"], "text-xs")}
            aria-label="Font Size"
            title="Dimensione carattere"
          >
            {fontSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <Divider />

          {/* Insert Elements */}
          <button type="button"
            onClick={handleShowLinkForm}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Insert Link"
            title="Inserisci link"
          >
            <Lucide icon="Link" className="w-4 h-4" />
          </button>

          {/* Table */}
          <div className="relative">
            <button type="button"
              onClick={() => setShowTableOptions(!showTableOptions)}
              className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
              aria-label="Insert Table"
              title="Inserisci tabella"
            >
              <Lucide icon="Table" className="w-4 h-4" />
            </button>
            {showTableOptions && (
              <div className="absolute mt-2 p-4 bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 rounded-md">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Righe:</label>
                    <input
                      type="number"
                      value={tableRows}
                      onChange={(e) => setTableRows(Number(e.target.value))}
                      min="1"
                      max="10"
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Colonne:</label>
                    <input
                      type="number"
                      value={tableCols}
                      onChange={(e) => setTableCols(Number(e.target.value))}
                      min="1"
                      max="10"
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button type="button"
                      onClick={insertTable}
                      className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Inserisci
                    </button>
                    <button type="button"
                      onClick={() => setShowTableOptions(false)}
                      className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal Rule */}
          <button type="button"
            onClick={() => {
              editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
            }}
            className={clsx(stylePluginToolbar["toolbar-item"], stylePluginToolbar["spaced"])}
            aria-label="Insert Horizontal Rule"
            title="Inserisci riga orizzontale"
          >
            <Lucide icon="Minus" className="w-4 h-4" />
          </button>

          {/* Clear Formatting */}
          <button type="button"
            onClick={clearFormatting}
            className={clsx(stylePluginToolbar["toolbar-item"])}
            aria-label="Clear Formatting"
            title="Rimuovi formattazione"
          >
            <Lucide icon="Trash" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form di inserimento link */}
      {isLinkFormVisible && (
        <div className={stylePluginToolbar["link-form-container"]}>
          <input
            type="text"
            placeholder="URL (es. https://esempio.com)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className={stylePluginToolbar["link-input"]}
          />
          <input
            type="text"
            placeholder="Titolo (opzionale)"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            className={stylePluginToolbar["link-input"]}
          />
          <div className={stylePluginToolbar["link-form-buttons"]}>
            <button type="button" onClick={handleLinkSubmit} className={stylePluginToolbar["link-submit"]}>
              Applica Link
            </button>
            <button type="button" onClick={handleLinkCancel} className={stylePluginToolbar["link-cancel"]}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
