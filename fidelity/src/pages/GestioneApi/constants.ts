// Operatori disponibili per i filtri
export const operatorOptions = [
  { value: "equals", label: "Uguale a" },
  { value: "not_equals", label: "Diverso da" },
  { value: "greater_than", label: "Maggiore di" },
  { value: "less_than", label: "Minore di" },
  { value: "contains", label: "Contiene" },
  { value: "not_contains", label: "Non contiene" },
  { value: "in", label: "In lista" },
  { value: "not_in", label: "Non in lista" }
];

// Tema personalizzato per Monaco Editor
export const monacoEditorTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '9CDCFE' },
    { token: 'string.value.json', foreground: 'CE9178' },
    { token: 'number.json', foreground: 'B5CEA8' },
    { token: 'keyword.json', foreground: '569CD6' },
    { token: 'operator.json', foreground: 'D4D4D4' }
  ],
  colors: {
    'editor.background': '#1e293b',
    'editor.foreground': '#e2e8f0',
    'editorLineNumber.foreground': '#64748b',
    'editorLineNumber.activeForeground': '#94a3b8'
  }
};

// Opzioni per Monaco Editor
export const monacoEditorOptions = {
  readOnly: true,
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  folding: true,
  fontSize: 13,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
  renderWhitespace: 'selection' as const,
  contextmenu: true,
  copyWithSyntaxHighlighting: true,
  domReadOnly: true,
  readOnlyMessage: {
    value: 'Questo editor è in sola lettura'
  }
};
