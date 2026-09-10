# Gestione API - Struttura Refactored

Questa pagina è stata completamente refactored da un file monolitico di ~2700 righe a una struttura modulare e manutenibile.

## 📂 Struttura File

```
src/pages/GestioneApi/
├── index.tsx                    # File originale (~2700 righe)
├── index.new.tsx                # Nuovo file refactored (~170 righe)
├── README.md                    # Questa documentazione
├── constants.ts                 # Costanti (operatori, configurazioni)
├── types.ts                     # Interfacce TypeScript
│
├── utils/                       # Utility functions
│   ├── chartHelpers.ts         # Helper per grafici Chart.js
│   ├── filterHelpers.ts        # Validazione e manipolazione filtri
│   └── exportHelpers.ts        # Export CSV/Excel/PDF
│
├── hooks/                       # Custom React hooks
│   ├── useApiKeyManagement.ts  # Gestione API keys
│   ├── useApiTesting.ts        # Logica test endpoint
│   ├── useStatistics.ts        # Fetch statistiche
│   ├── useFilterTemplates.ts   # CRUD template filtri
│   └── useStatisticsExport.ts  # Hook export
│
├── components/
│   ├── statistics/             # Tab Statistiche
│   │   ├── StatisticsTab.tsx
│   │   ├── StatCard.tsx
│   │   ├── ActivityTable.tsx
│   │   └── ExportButton.tsx
│   │
│   ├── test-api/               # Tab Test API
│   │   ├── TestApiTab.tsx
│   │   ├── GetRefsTestPanel.tsx
│   │   ├── GetFilesTestPanel.tsx
│   │   ├── FilterValueInput.tsx
│   │   └── MonacoJsonViewer.tsx
│   │
│   ├── api-keys/               # Tab API Keys
│   │   └── ApiKeysTab.tsx
│   │
│   └── plugin/                 # Tab Plugin
│       ├── PluginTab.tsx
│       ├── FilterTemplateList.tsx
│       ├── FilterTemplateForm.tsx
│       └── PluginConfigPanel.tsx
│
└── sub-components/             # Componenti condivisi
    └── TemplateFilterCard.tsx
```

## 🎯 Componenti Principali

### index.new.tsx (Main Component)
**Ridotto da ~2700 a ~170 righe**

Responsabilità:
- Orchestrazione tab navigation
- Caricamento dati iniziali via loader
- Integrazione custom hooks
- Passaggio props ai componenti figli

### Custom Hooks

#### `useApiKeyManagement()`
Gestisce generazione e copia API keys.
```typescript
const { apiKey, copied, isGenerating, generateKey, copyToClipboard } = useApiKeyManagement();
```

#### `useApiTesting()`
Logica test endpoint API (refs/files/refs-html).
```typescript
const { selectedEndpoint, testData, testResponse, executeTest } = useApiTesting();
```

#### `useStatistics()`
Fetch e elaborazione statistiche API.
```typescript
const { stats, detailedStats, statsLoading, refetchStats } = useStatistics();
```

#### `useFilterTemplates()`
Operazioni CRUD per template filtri.
```typescript
const { create, update, delete, isCreating } = useFilterTemplates();
```

#### `useStatisticsExport()`
Export statistiche in vari formati.
```typescript
const { exportToCSV, exportToExcel, exportToPDF } = useStatisticsExport();
```

### Tab Components

#### StatisticsTab
- Visualizza card statistiche aggregate
- Grafici (success rate, endpoints, temporali)
- Tabella attività recente
- Bottone export integrato

#### TestApiTab
- Selettore endpoint (refs/files/refs-html)
- Rendering condizionale GetRefsTestPanel/GetFilesTestPanel
- Gestione stato test condiviso

#### ApiKeysTab
- Visualizzazione API key corrente
- Generazione nuova chiave
- Copy to clipboard

#### PluginTab
- Lista template filtri disponibili
- Form CRUD per template (create/edit/delete)
- Pannello configurazione plugin
- Generatore codice integrazione

## 🔧 Utility Functions

### chartHelpers.ts
- `createSuccessRateChartData()` - Dati grafico a torta
- `createEndpointChartData()` - Dati grafico a barre
- `createTemporalChartData()` - Dati grafico lineare
- `chartOptions` - Configurazioni Chart.js

### filterHelpers.ts
- `validateFilterCondition()` - Valida singola condizione
- `validateFilterGroup()` - Valida gruppo filtri
- `formatFiltersForApi()` - Formatta per backend
- `createEmptyFilterCondition()` - Helper creazione
- `cloneFilterGroups()` - Clone sicuro

### exportHelpers.ts
- `exportStatisticsToCSV()` - Export CSV con download automatico
- `exportStatisticsToExcel()` - Export Excel multi-sheet (xlsx)
- `exportStatisticsToPDF()` - Export PDF tramite server (mupdf)

## 🆕 Nuove Funzionalità

### 1. CRUD Template Filtri
**Componente:** `FilterTemplateForm.tsx`

Form completo con:
- Validazione Zod
- React Hook Form
- Campi: nome, slug, descrizione, endpoint_type, render_type
- Opzioni visualizzazione: auto_scroll, scroll_speed, show_indicators, show_nav_buttons
- Validazione slug unicità (client + server)

### 2. Export Statistiche
**Componente:** `ExportButton.tsx`

Formati supportati:
- **CSV**: Tabella semplice con dettagli attività
- **Excel**: Multi-sheet (Panoramica, Dettagli, Endpoints)
- **PDF**: Report formattato con grafici e tabelle

## 🔄 Migrazione da index.tsx a index.new.tsx

### Step 1: Backup
```bash
mv index.tsx index.old.tsx
mv index.new.tsx index.tsx
```

### Step 2: Verifica Import
Verificare che tutti gli import in `src/router/index.tsx` puntino correttamente.

### Step 3: Test
1. Navigare a `/gestione-api`
2. Verificare tutte le tab funzionino
3. Testare generazione API key
4. Testare endpoint refs/files
5. Testare export statistiche
6. Testare CRUD template filtri

### Step 4: Cleanup
Una volta verificato il corretto funzionamento:
```bash
rm index.old.tsx
```

## 📝 Note Implementative

### Convenzioni Naming
- **Componenti**: PascalCase (`StatisticsTab.tsx`)
- **Hooks**: camelCase con prefisso `use` (`useStatistics.ts`)
- **Utils**: camelCase (`chartHelpers.ts`)

### Gestione Stato
- **Stato locale**: `useState` per UI state effimero
- **Server state**: React Query (`useFetch*` hooks)
- **Form state**: React Hook Form + Zod validation
- **NO Redux**: Solo per theme e dark mode

### Error Handling
- Form errors: Inline sotto campo
- API errors: Toast notification
- Validation errors: Highlight + tooltip
- Network errors: Auto-retry (React Query)

### Performance
- Code splitting: Ogni tab può essere lazy-loaded
- Query caching: React Query (stale time 10s)
- Chart optimization: Canvas rendering
- Monaco Editor: Already lazy-loaded

## 🐛 Troubleshooting

### Problema: Grafici non si visualizzano
**Soluzione**: Verificare import `Chart.js` e helpers in `chartHelpers.ts`

### Problema: Export PDF fallisce
**Soluzione**:
1. Verificare import `jspdf` e `jspdf-autotable`
2. Verificare type declarations in `exportHelpers.ts`
3. Limitare dataset a max 100 righe se troppo grande

### Problema: Form validation non funziona
**Soluzione**: Verificare schema Zod in `FilterTemplateForm.tsx` e resolver

### Problema: API key non si genera
**Soluzione**:
1. Verificare endpoint `/external/generate-api-key`
2. Check user session
3. Verificare `useApiKeyManagement` hook

## 📚 Dependencies Usate

- `react-hook-form` - Form management
- `@hookform/resolvers` - Zod resolver
- `zod` - Schema validation
- `xlsx` - Excel export
- `mupdf` (server-side) - PDF export
- `@monaco-editor/react` - JSON viewer
- `chart.js` - Grafici
- `@tanstack/react-query` - Server state

## 🎨 Best Practices

1. **Un componente = Una responsabilità**
2. **Hook per business logic, non UI**
3. **Utility functions pure (no side effects)**
4. **Props interface sempre tipizzate**
5. **Error boundaries per ogni tab**
6. **Loading states ovunque**
7. **Accessibilità (ARIA labels)**
8. **Responsive design**

## 🚀 Estensioni Future

- [ ] Template versioning
- [ ] Template import/export
- [ ] Real-time stats via WebSocket
- [ ] Advanced filtering UI
- [ ] API usage analytics dashboard
- [ ] Rate limiting configuration
- [ ] Webhook integration
- [ ] API documentation generator

---

**Refactored by**: Claude Code
**Data**: 2026-01-16
**Versione**: 2.0.0
