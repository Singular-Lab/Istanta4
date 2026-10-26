// ecosystem.config.cjs
// Configurazione PM2 per avviare Fidelity Promotion DIRETTAMENTE, senza passare da `npm start`.
// PM2 esegue:  node node_modules/tsx/dist/cli.mjs server/index.ts
// tsx carica i sorgenti TypeScript e propaga il proprio loader ai worker che il codice forka
// internamente tramite il modulo `cluster` di Node (vedi server/core/cluster.ts).
//
// ┌─ REGOLA CRITICA ───────────────────────────────────────────────────────────────────────────┐
// │ DEVE restare in FORK mode con UNA sola istanza.                                              │
// │ Il WebSocket server (server/ws-server.ts) parte SOLO nel processo primary dell'app, che a   │
// │ sua volta forka i worker HTTP. In PM2 CLUSTER mode non esiste un primary a livello di app    │
// │ (il master è PM2, le istanze sono tutte worker) → `startWSServer()` fa skip → il WS non      │
// │ parte da nessuna parte e le presenze del menabò si rompono.                                  │
// │ Quindi: exec_mode 'fork' + instances 1. NON usare -i / cluster.                              │
// └─────────────────────────────────────────────────────────────────────────────────────────────┘
//
// Avvio:   pm2 start ecosystem.config.cjs
// Reload:  pm2 reload ecosystem.config.cjs   (zero-downtime non garantito: il WS è single-master)
// Stop:    pm2 stop fidelity_promotion

module.exports = {
  apps: [
    {
      name: 'fidelity_promotion',

      // Percorso del deploy di produzione (confermato dai log: /var/www/fidelity_promotion).
      // Cambialo qui se l'app vive in un'altra directory.
      cwd: '/var/www/fidelity_promotion',

      // Lancio diretto del server, senza il layer `npm`. Equivale a `tsx server/index.ts`:
      // l'entry-point è il file dell'app (così PM2 legge la versione dal package.json del progetto,
      // non quella di tsx) e tsx viene caricato come loader di Node via `--import tsx`.
      // `node --import tsx` propaga il loader anche ai worker che il codice forka con cluster.fork().
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',

      // Il clustering HTTP lo gestisce il codice (startClusterIfNeeded): PM2 deve vedere 1 processo.
      exec_mode: 'fork',
      instances: 1,

      // Forza l'ambiente di produzione a prescindere da cosa c'è nel .env: dotenv non sovrascrive
      // le variabili già presenti in process.env, quindi questo valore vince.
      env: {
        NODE_ENV: 'production',
      },

      autorestart: true,
      // Lascia tempo allo shutdown controllato: server.ts gestisce SIGTERM con timeout interno 10s.
      kill_timeout: 12000,
      // Timestamp nelle righe di log PM2.
      time: true,
    },
  ],
};
