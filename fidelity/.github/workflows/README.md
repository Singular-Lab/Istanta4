# GitHub Actions CI/CD Matrix Workflows

Questo repository include workflow CI/CD avanzati che utilizzano le strategie matrix di GitHub Actions per testare il progetto su multiple combinazioni di sistemi operativi e versioni di Node.js.

## Workflow Disponibili

### 1. `ci.yml` - Workflow Matrix Completo
Il workflow principale che esegue test completi su multiple configurazioni.

**Caratteristiche:**
- **Quality Checks**: Testa su 3 OS × 3 versioni Node.js (escludendo combinazioni problematiche)
- **Server Tests**: Testa su 2 OS × 2 versioni Node.js con coverage
- **Build Tests**: Testa build su 3 OS con Node.js 18 + Ubuntu con Node.js 20
- **Dependency Analysis**: Analisi dipendenze solo su Pull Request
- **Aggregation**: Raccoglie e riporta tutti i risultati

**Matrix Configuration:**
```yaml
# Quality Checks Matrix
os: [ubuntu-latest, windows-latest, macos-latest]
node-version: [16, 18, 20]
exclude:
  - os: windows-latest
    node-version: 16
  - os: macos-latest
    node-version: 16
```

### 2. `ci-simple.yml` - Workflow Semplificato
Versione semplificata che utilizza workflow riutilizzabili per ridurre la duplicazione del codice.

**Vantaggi:**
- Codice DRY (Don't Repeat Yourself)
- Manutenzione semplificata
- Logica centralizzata nel workflow riutilizzabile

### 3. `common.yml` - Workflow Riutilizzabile
Workflow chiamabile che centralizza le operazioni comuni.

**Input Parameters:**
- `node-version`: Versione di Node.js da utilizzare
- `os`: Sistema operativo target
- `cache-key`: Chiave aggiuntiva per il cache
- `steps`: Operazioni da eseguire (setup, install, test, build, quality)

## Caratteristiche Avanzate

### Cache Intelligente
Ogni job utilizza cache specifici per OS e versione Node.js:
```yaml
key: ${{ runner.os }}-node-${{ matrix.node-version }}-${{ hashFiles('**/package-lock.json') }}
```

### Fail-Fast Control
```yaml
fail-fast: false  # Permette a tutti i job di completare anche se alcuni falliscono
```

### Concurrency Control
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # Cancella esecuzioni precedenti dello stesso branch
```

### Matrix Include/Exclude
- **Include**: Specifica combinazioni esatte da testare
- **Exclude**: Rimuove combinazioni problematiche dalla matrice

## Strategie Matrix Implementate

### 1. Multi-dimensional Matrices
Testa ogni combinazione di OS e versione Node.js:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [16, 18, 20]
```

### 2. Include/Exclude Filters
Controllo granulare sulle combinazioni da eseguire:
```yaml
exclude:
  - os: windows-latest
    node-version: 16  # Salta Node.js 16 su Windows
```

### 3. Conditional Execution
Job che si eseguono solo in determinate condizioni:
```yaml
if: github.event_name == 'pull_request'  # Solo su PR
```

## Artifacts e Reporting

### Coverage Reports
Ogni job di test genera report di coverage:
```yaml
- name: Upload coverage reports
  uses: actions/upload-artifact@v4
  with:
    name: coverage-${{ matrix.os }}-node-${{ matrix.node-version }}
    path: coverage/
```

### Build Artifacts
Ogni build genera artifacts per il deployment:
```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-${{ matrix.os }}-node-${{ matrix.node-version }}
    path: dist/
```

### Aggregated Results
Job finale che raccoglie tutti i risultati:
```yaml
- name: Download all coverage reports
  uses: actions/download-artifact@v4
  with:
    pattern: coverage-*
    merge-multiple: true
```

## Best Practices Implementate

### 1. DRY Principle
- Workflow riutilizzabili per logica comune
- Cache condivisi tra job simili
- Configurazioni centralizzate

### 2. Performance Optimization
- Cache intelligente per dipendenze
- Job paralleli dove possibile
- Concurrency control per evitare conflitti

### 3. Reliability
- `fail-fast: false` per debugging completo
- Job di aggregazione sempre eseguiti (`if: always()`)
- Gestione errori robusta

### 4. Maintainability
- Workflow modulari e riutilizzabili
- Documentazione completa
- Configurazioni chiare e commentate

## Utilizzo

### Per Pull Request
Il workflow si attiva automaticamente su PR verso `main` o `develop`:
- Esegue tutti i controlli di qualità
- Testa su multiple configurazioni
- Genera report di coverage
- Analizza dipendenze

### Per Push Diretti
Su push a `main` o `develop`:
- Esegue build e test completi
- Verifica compatibilità cross-platform
- Genera artifacts per deployment

### Workflow Manuale
Puoi anche attivare manualmente i workflow dalla sezione Actions di GitHub.

## Monitoraggio

### GitHub Step Summary
Ogni esecuzione genera un report dettagliato con:
- Status di ogni job matrix
- Coverage reports aggregati
- Build artifacts disponibili
- Dipendenze outdated

### Artifacts Retention
- Coverage reports: 30 giorni
- Build artifacts: 7 giorni
- Aggregated results: 30 giorni

## Troubleshooting

### Job Falliti
1. Controlla i log specifici del job
2. Verifica la compatibilità OS/Node.js
3. Controlla le dipendenze e cache

### Performance Issues
1. Verifica l'efficacia del cache
2. Considera di ridurre le combinazioni matrix
3. Ottimizza i tempi di build

### Cache Problems
1. Invalida il cache modificando `package-lock.json`
2. Verifica le chiavi di cache
3. Controlla i percorsi di cache

## Estensioni Future

### Possibili Miglioramenti
1. **Database Matrix**: Test con diversi database (MongoDB, Redis)
2. **Browser Matrix**: Test frontend su diversi browser
3. **Security Scanning**: Integrazione con CodeQL
4. **Deployment Matrix**: Deploy su diversi ambienti
5. **Performance Testing**: Benchmark su diverse configurazioni

### Actions Aggiuntive
- `codeql-action/init` per security scanning
- `coverallsapp/github-action` per coverage reporting
- `slackapi/slack-github-action` per notifiche
- `docker/build-push-action` per container builds 