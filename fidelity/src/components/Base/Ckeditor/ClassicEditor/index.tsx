import styles from '@/assets/css/editor.module.scss';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { InitialEditorStateType, LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import {
  $getRoot,
  EditorThemeClasses,
  HTMLConfig,
  Klass,
  LexicalEditor,
  LexicalNode,
  LexicalNodeReplacement,
  ParagraphNode,
  TextNode
} from "lexical";
import { useEffect, useRef, useState } from "react";
import ToolbarPlugin from "./plugins/ToolbarPlugin";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ExtendedTextNode } from "./ExtendedTextNode";
interface CkeditorProps {
  key?: number | string;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const removeStylesExportDOM = (editor: any, target: { exportDOM: (arg0: any) => any }) => {
  const output = target.exportDOM(editor);
  return output;
};

const parseAllowedFontSize = (fontSize: string | null | undefined): string => {
  if (!fontSize) return "";
  const match = fontSize.trim().match(/^(\d+(?:\.\d+)?)px$/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 8 && n <= 96) return fontSize.trim();
  }
  return "";
};

const parseAllowedColor = (color: string | null | undefined): string => {
  if (!color) return "";
  const c = color.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(c)) return c;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(c)) return c;
  if (/^[a-zA-Z]+$/.test(c)) return c;
  return "";
};

const exportMap = new Map<typeof ParagraphNode | typeof ExtendedTextNode, (editor: any, target: { exportDOM: (arg0: any) => any; }) => any>();

exportMap.set(ParagraphNode, removeStylesExportDOM);
exportMap.set(ExtendedTextNode, removeStylesExportDOM);

const getExtraStyles = (element: { style: { fontSize: any; backgroundColor: any; color: any; }; }) => {
  let extraStyles = "";
  const fontSize = parseAllowedFontSize(element.style.fontSize);
  const backgroundColor = parseAllowedColor(element.style.backgroundColor);
  const color = parseAllowedColor(element.style.color);
  if (fontSize !== "" && fontSize !== "16px") {
    extraStyles += `font-size: ${fontSize};`;
  }
  if (backgroundColor !== "" && backgroundColor !== "rgb(255, 255, 255)" && backgroundColor !== "#ffffff") {
    extraStyles += `background-color: ${backgroundColor};`;
  }
  if (color !== "" && color !== "rgb(0, 0, 0)" && color !== "#000000") {
    extraStyles += `color: ${color};`;
  }
  return extraStyles;
};

const constructImportMap = (): Record<string, (importNode: HTMLElement) => any> => {
  const importMap: Record<string, (importNode: HTMLElement) => any> = {};

  for (const [tag, fn] of Object.entries(ExtendedTextNode.importDOM() || {})) {
    importMap[tag] = (importNode: HTMLElement) => {
      const importer = fn(importNode);
      if (!importer) {
        return null;
      }
      return {
        ...importer,
        conversion: (element: HTMLElement) => {
          const output = importer.conversion(element);
          if (
            output === null ||
            output.forChild === undefined ||
            output.after !== undefined ||
            output.node !== null
          ) {
            return output;
          }
          const extraStyles = getExtraStyles(element);
          if (extraStyles) {
            const { forChild } = output;
            return {
              ...output,
              forChild: (child: any, parent: any | null | undefined) => {
                const textNode = forChild(child, parent);
                if (textNode && "setStyle" in textNode) {
                  (textNode as any).setStyle((textNode as any).getStyle() + extraStyles);
                }
                return textNode;
              },
            };
          }
          return output;
        },
      };
    };
  }

  return importMap;
};

const editorConfig: Readonly<{
  namespace: string;
  nodes?: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>;
  onError: (error: Error, editor: LexicalEditor) => void;
  editable?: boolean;
  theme?: EditorThemeClasses;
  editorState?: InitialEditorStateType;
  html?: HTMLConfig;
}> = {
  html: {
    export: exportMap,
    import: constructImportMap(),
  },
  editable: true,
  namespace: "Rich Text Editor",
  nodes: [
    ParagraphNode,
    ExtendedTextNode,
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    HorizontalRuleNode,
    {
      replace: TextNode,
      with: (node: TextNode) => new ExtendedTextNode(node.__text),
      withKlass: ExtendedTextNode,
    },
  ],
  onError(error: any) {
    console.error(error);
  },
  theme: {
    code: styles["editor-code"],
    codeHighlight: {
      atrule: styles["editor-tokenAttr"],
      attr: styles["editor-tokenAttr"],
      boolean: styles["editor-tokenProperty"],
      builtin: styles["editor-tokenSelector"],
      cdata: styles["editor-tokenComment"],
      char: styles["editor-tokenSelector"],
      class: styles["editor-tokenFunction"],
      'class-name': styles["editor-tokenFunction"],
      comment: styles["editor-tokenComment"],
      constant: styles["editor-tokenProperty"],
      deleted: styles["editor-tokenProperty"],
      doctype: styles["editor-tokenComment"],
      entity: styles["editor-tokenOperator"],
      function: styles["editor-tokenFunction"],
      important: styles["editor-tokenVariable"],
      inserted: styles["editor-tokenSelector"],
      keyword: styles["editor-tokenAttr"],
      namespace: styles["editor-tokenVariable"],
      number: styles["editor-tokenProperty"],
      operator: styles["editor-tokenOperator"],
      prolog: styles["editor-tokenComment"],
      property: styles["editor-tokenProperty"],
      punctuation: styles["editor-tokenPunctuation"],
      regex: styles["editor-tokenVariable"],
      selector: styles["editor-tokenSelector"],
      string: styles["editor-tokenSelector"],
      symbol: styles["editor-tokenProperty"],
      tag: styles["editor-tokenProperty"],
      url: styles["editor-tokenOperator"],
      variable: styles["editor-tokenVariable"],
    },
    heading: {
      h1: styles["editor-heading-h1"],
      h2: styles["editor-heading-h2"],
      h3: styles["editor-heading-h3"],
      h4: styles["editor-heading-h4"],
      h5: styles["editor-heading-h5"],
      h6: styles["editor-heading-h6"],
    },
    hr: styles["editor-hr"],
    image: styles["editor-image"],
    link: styles["editor-link"],
    list: {
      listitem: styles["editor-listitem"],
      nested: {
        listitem: styles["editor-nested-listitem"],
      },
      ol: styles["editor-list-ol"],
      ul: styles["editor-list-ul"],
    },
    ltr: styles["ltr"],
    paragraph: styles["editor-paragraph"],
    placeholder: styles["editor-placeholder"],
    quote: styles["editor-quote"],
    rtl: styles["rtl"],
    table: styles["editor-table"],
    tableCell: styles["editor-tableCell"],
    tableCellHeader: styles["editor-tableCellHeader"],
    text: {
      bold: styles["editor-text-bold"],
      code: styles["editor-text-code"],
      hashtag: styles["editor-text-hashtag"],
      italic: styles["editor-text-italic"],
      overflowed: styles["editor-text-overflowed"],
      strikethrough: styles["editor-text-strikethrough"],
      subscript: styles["editor-text-subscript"],
      superscript: styles["editor-text-superscript"],
      underline: styles["editor-text-underline"],
      underlineStrikethrough: styles["editor-text-underlineStrikethrough"],
    },
  },
};
function Editor({
  disabled = false,
  value = "",
  onChange = () => { },
  className,
  placeholder = "Inserisci il testo..."
}: CkeditorProps) {

  const [editor] = useLexicalComposerContext();
  const [contentLoaded, setContentLoaded] = useState(false);
  const [lastLoadedValue, setLastLoadedValue] = useState("");

  // Ref stabile per onChange: evita che il listener si ri-registri ad ogni render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Traccia l'ultimo HTML emesso dall'editor stesso, per distinguere cambiamenti
  // interni (digitazione utente) da cambiamenti esterni (parent che passa nuovo value)
  const lastEmittedRef = useRef<string>("");

  // Segnala se il caricamento iniziale è avvenuto: impedisce a handleUpdate di
  // chiamare onChange con "" durante il primo update di Lexical (editor vuoto),
  // che altrimenti azzererebbe values.contenuto nel parent prima del caricamento reale
  const isInitializedRef = useRef(false);

  // Reset contentLoaded solo quando il value cambia dall'esterno (non dalla digitazione)
  useEffect(() => {
    if (value !== lastLoadedValue && value !== lastEmittedRef.current) {
      isInitializedRef.current = false;
      setContentLoaded(false);
    }
  }, [value, lastLoadedValue]);

  // Carica il contenuto quando necessario
  useEffect(() => {
    if (!contentLoaded) {
      editor.update(() => {
        const parser = new DOMParser();
        const root = $getRoot();
        root.clear();

        if (value && value.trim() !== "") {
          const dom = parser.parseFromString(value, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          root.append(...nodes);
        }

        root.selectEnd();
      }, {
        onUpdate: () => {
          isInitializedRef.current = true;
          setContentLoaded(true);
          setLastLoadedValue(value);
        },
      });
    }
  }, [value, editor, contentLoaded]);

  // Gestione delle modifiche: genera l'HTML dall'albero dei nodi con pulizia.
  // Non emette durante il caricamento iniziale (isInitializedRef.current = false)
  // per evitare che il primo update vuoto di Lexical azzeri il contenuto nel parent.
  useEffect(() => {
    const handleUpdate = () => {
      if (!isInitializedRef.current) return;
      editor.getEditorState().read(() => {
        let html = $generateHtmlFromNodes(editor, null);
        html = cleanEmptyHtml(html);
        lastEmittedRef.current = html;
        onChangeRef.current(html);
      });
    };

    const unregisterListener = editor.registerUpdateListener(handleUpdate);
    return () => unregisterListener();
  }, [editor]);

  const cleanEmptyHtml = (html: string) => {
    if (!html) return '';

    // Controlli diretti per casi semplici
    if (html === '<br>' || html === '<p><br></p>' || html === '<p dir="ltr"><br></p>') {
      return '';
    }

    // Usa DOM per analisi più approfondita
    const tempDiv = document.createElement('div') as HTMLDivElement;
    tempDiv.innerHTML = html;

    // Controlla se c'è testo effettivo
    if (!tempDiv.textContent || tempDiv.textContent.trim() === '') {
      // Verifica ogni elemento per vedere se contiene qualcosa oltre a <br>
      const paragraphs = tempDiv.querySelectorAll('p');
      let isEmpty = true;

      for (const p of paragraphs) {
        // Se il paragrafo ha contenuto di testo o ha figli che non sono <br>
        if (p.textContent?.trim() !== '' ||
          (p.childNodes.length > 0 && !Array.from(p.childNodes).every(node =>
            node.nodeType === 3 || (node.nodeType === 1 && node.nodeName === 'BR')))) {
          isEmpty = false;
          break;
        }
      }

      if (isEmpty) {
        return '';
      }
    }

    return html;
  };

  return (
    <div className={`${className || ""} w-full`}>
      <div className={styles.editorContainer}>
        <ToolbarPlugin />
        <div className={styles.editorInner}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={styles.editorInput}
                aria-placeholder={placeholder}
                placeholder={<div className={styles.editorPlaceholder}>{placeholder}</div>}
              />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TabIndentationPlugin />
          <TablePlugin />
          <HorizontalRulePlugin />
        </div>
      </div>
    </div>
  );
}

const Ckeditor = ({
  disabled = false,
  value = "",
  onChange = () => { },
  className,
  key,
  placeholder
}: CkeditorProps) => {
  return (
    <LexicalComposer
      key={key} // Assicurati che questo key rimanga stabile per evitare remount non necessari
      initialConfig={{
        ...editorConfig,
        editable: !disabled,
      }}
    >
      <Editor
        key={key}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={className}
        placeholder={placeholder}
      />
    </LexicalComposer>
  );
};

export default Ckeditor;
