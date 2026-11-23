import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import {
  argomentiGhostscriptPagina,
  CodaLavori,
  codificaPagina,
  percorsoCachePagina,
  prendiLock,
  RESA_BASE,
  RESA_LETTURA,
  resaRichiesta,
  scriviFileAtomico,
  unaVoltaPerChiave,
} from './pagine-pdf';

describe('resaRichiesta', () => {
  it.each([undefined, null, '', '150', ' 150 '])('senza dpi o con 150 (%p) dà la resa base', (dpi) => {
    expect(resaRichiesta(dpi)).toBe(RESA_BASE);
  });

  it.each(['300', ' 300'])('con 300 (%p) dà la resa di lettura', (dpi) => {
    expect(resaRichiesta(dpi)).toBe(RESA_LETTURA);
  });

  it.each(['600', '72', '299', 'alta', '300dpi'])('rifiuta un valore non ammesso (%p)', (dpi) => {
    expect(resaRichiesta(dpi)).toBeNull();
  });
});

describe('argomentiGhostscriptPagina', () => {
  it('per la resa base sono quelli di sempre, da cui dipende l\'MD5 dei PDF di una pagina', () => {
    expect(argomentiGhostscriptPagina('/m/f.pdf', 3, RESA_BASE, '-dNOSAFER')).toEqual([
      '-q',
      '-dNOSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=png16m',
      '-dFirstPage=3',
      '-dLastPage=3',
      '-r150',
      '-sOutputFile=-',
      '/m/f.pdf',
    ]);
  });

  it('per la lettura disegnano a 600 dpi, senza l\'antialias di Ghostscript che rallenta certi PDF', () => {
    const args = argomentiGhostscriptPagina('/m/f.pdf', 2, RESA_LETTURA, '-dSAFER');
    expect(args).toContain('-r600');
    expect(args.some((a) => /AlphaBits|InterpolateControl/.test(a))).toBe(false);
    expect(args.slice(-2)).toEqual(['-sOutputFile=-', '/m/f.pdf']);
  });
});

describe('percorsoCachePagina', () => {
  it('tiene separati i file delle due rese', () => {
    expect(percorsoCachePagina('/t', 'm1', 4, RESA_BASE)).toBe(path.join('/t', 'm1_page4.webp'));
    expect(percorsoCachePagina('/t', 'm1', 4, RESA_LETTURA)).toBe(path.join('/t', 'm1_page4_300dpi.webp'));
  });
});

describe('codificaPagina', () => {
  const png = () =>
    sharp({ create: { width: 120, height: 80, channels: 3, background: { r: 220, g: 30, b: 30 } } })
      .png()
      .toBuffer();

  it('la resa base resta della misura del disegno', async () => {
    const meta = await sharp(await codificaPagina(await png(), RESA_BASE)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 120, 80]);
  });

  it('la resa di lettura riduce a metà il disegno a 600 dpi, cioè a 300 dpi', async () => {
    const meta = await sharp(await codificaPagina(await png(), RESA_LETTURA)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 60, 40]);
  });
});

describe('file su disco', () => {
  let cartella: string;

  beforeEach(async () => {
    cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-pagine-'));
  });

  afterEach(async () => {
    await fs.promises.rm(cartella, { recursive: true, force: true });
  });

  describe('scriviFileAtomico', () => {
    it('scrive il file senza lasciare temporanei', async () => {
      const percorso = path.join(cartella, 'm1_page1_300dpi.webp');
      await scriviFileAtomico(percorso, Buffer.from('contenuto'));
      expect(await fs.promises.readFile(percorso, 'utf8')).toBe('contenuto');
      expect(await fs.promises.readdir(cartella)).toEqual(['m1_page1_300dpi.webp']);
    });

    it('se la scrittura fallisce rilancia l\'errore e non lascia temporanei', async () => {
      const percorso = path.join(cartella, 'manca', 'm1_page1.webp');
      await expect(scriviFileAtomico(percorso, Buffer.from('x'))).rejects.toThrow();
      expect(await fs.promises.readdir(cartella)).toEqual([]);
    });
  });

  describe('prendiLock', () => {
    it('un secondo processo non prende il lock finché il primo non lo rilascia', async () => {
      const percorso = path.join(cartella, 'm1_page1_300dpi.webp');

      const rilascia = await prendiLock(percorso);
      expect(rilascia).not.toBeNull();
      expect(await prendiLock(percorso)).toBeNull();

      await rilascia();
      const ancora = await prendiLock(percorso);
      expect(ancora).not.toBeNull();
      await ancora();
      expect(await fs.promises.readdir(cartella)).toEqual([]);
    });

    it('un lock scaduto, lasciato da un processo morto, si riprende', async () => {
      const percorso = path.join(cartella, 'm1_page2_300dpi.webp');
      await fs.promises.writeFile(`${percorso}.lock`, '999999 vecchio');
      const unOraFa = new Date(Date.now() - 60 * 60 * 1000);
      await fs.promises.utimes(`${percorso}.lock`, unOraFa, unOraFa);

      const rilascia = await prendiLock(percorso, 10 * 60 * 1000);

      expect(rilascia).not.toBeNull();
      await rilascia();
    });
  });
});

describe('unaVoltaPerChiave', () => {
  it('chi arriva mentre il lavoro è in corso ne aspetta l\'esito invece di ripeterlo', async () => {
    let chiamate = 0;
    let finisci!: (valore: string) => void;
    const lavoro = () => {
      chiamate++;
      return new Promise<string>((resolve) => (finisci = resolve));
    };

    const prima = unaVoltaPerChiave('pagina-1', lavoro);
    const seconda = unaVoltaPerChiave('pagina-1', lavoro);
    finisci('webp');

    await expect(Promise.all([prima, seconda])).resolves.toEqual(['webp', 'webp']);
    expect(chiamate).toBe(1);
  });

  it('a lavoro finito, anche se fallito, la chiave si libera', async () => {
    await expect(unaVoltaPerChiave('pagina-2', () => Promise.reject(new Error('gs')))).rejects.toThrow('gs');
    await expect(unaVoltaPerChiave('pagina-2', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});

describe('CodaLavori', () => {
  const attesa = () => new Promise((r) => setTimeout(r, 5));

  it('esegue un lavoro alla volta, nell\'ordine in cui arrivano', async () => {
    const coda = new CodaLavori();
    const ordine: string[] = [];
    let attivi = 0;
    let picco = 0;
    const lavoro = (nome: string) => async () => {
      attivi++;
      picco = Math.max(picco, attivi);
      await attesa();
      ordine.push(nome);
      attivi--;
    };

    await Promise.all(['a', 'b', 'c'].map((n) => coda.aggiungi(n, lavoro(n))));

    expect(ordine).toEqual(['a', 'b', 'c']);
    expect(picco).toBe(1);
  });

  it('non mette in coda due volte lo stesso PDF', async () => {
    const coda = new CodaLavori();
    let chiamate = 0;
    const lavoro = async () => {
      chiamate++;
      await attesa();
    };

    const prima = coda.aggiungi('m1', lavoro);
    const seconda = coda.aggiungi('m1', lavoro);

    expect(seconda).toBe(prima);
    expect(coda.prevista('m1')).toBe(true);
    await prima;
    expect(chiamate).toBe(1);
    expect(coda.prevista('m1')).toBe(false);
  });

  it('un lavoro con inTesta passa davanti a quelli in attesa, anche se era già in coda', async () => {
    const coda = new CodaLavori();
    const ordine: string[] = [];
    const lavoro = (nome: string) => async () => {
      await attesa();
      ordine.push(nome);
    };

    coda.aggiungi('archivio-1', lavoro('archivio-1'));
    coda.aggiungi('archivio-2', lavoro('archivio-2'));
    coda.aggiungi('archivio-3', lavoro('archivio-3'));
    coda.aggiungi('archivio-3', lavoro('archivio-3'), { inTesta: true });
    coda.aggiungi('chiesto', lavoro('chiesto'), { inTesta: true });
    await coda.finita();

    // archivio-1 era già partito; poi l'ultimo arrivato in testa, poi archivio-3 spostato
    expect(ordine).toEqual(['archivio-1', 'chiesto', 'archivio-3', 'archivio-2']);
  });

  it('un lavoro fallito non ferma la coda e la sua promessa si risolve', async () => {
    const errori: string[] = [];
    const coda = new CodaLavori((chiave) => errori.push(chiave));
    let dopo = false;

    await expect(coda.aggiungi('rotto', () => Promise.reject(new Error('gs')))).resolves.toBeUndefined();
    await coda.aggiungi('sano', async () => {
      dopo = true;
    });

    expect(errori).toEqual(['rotto']);
    expect(dopo).toBe(true);
  });

  it('finita si risolve subito con la coda vuota e alla fine dei lavori altrimenti', async () => {
    const coda = new CodaLavori();
    await expect(coda.finita()).resolves.toBeUndefined();

    let fatto = false;
    coda.aggiungi('m1', async () => {
      await attesa();
      fatto = true;
    });
    await coda.finita();
    expect(fatto).toBe(true);
  });
});
