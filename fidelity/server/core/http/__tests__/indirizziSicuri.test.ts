import { afterEach, describe, expect, it, vi } from 'vitest';

// Il DNS e' finto: ogni nome risolve negli indirizzi della tabella, gli altri non esistono
const dns = vi.hoisted(() => ({ tabella: {} as Record<string, string[]> }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const indirizzi = dns.tabella[host];
    if (!indirizzi) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return indirizzi.map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
  }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  chiamaUrlSicuro,
  CorpoTroppoGrandeError,
  IndirizzoNonSicuroError,
  leggiCorpoLimitato,
  MASSIMO_REDIRECT,
  motivoIpVietato,
  verificaUrlSicuro,
} from '../indirizziSicuri';

const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const redirect = (location: string, status = 302) => new Response(null, { status, headers: { location } });

afterEach(() => {
  fetchFinto.mockReset();
  dns.tabella = {};
});

describe('motivoIpVietato', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.10.20.30', 'loopback'],
    ['::1', 'loopback'],
    ['169.254.169.254', 'link-local o metadati cloud'],
    ['169.254.1.1', 'link-local o metadati cloud'],
    ['fe80::1', 'link-local'],
    ['fe80::1%eth0', 'link-local'],
    ['febf::1', 'link-local'],
    ['0.0.0.0', 'indirizzo non specificato'],
    ['::', 'indirizzo non specificato'],
    ['fd00:ec2::254', 'metadati cloud'],
  ])('rifiuta %s (%s)', (ip, motivo) => {
    expect(motivoIpVietato(ip)).toBe(motivo);
  });

  it.each([
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:7f00:1', 'loopback'],
    ['::ffff:169.254.169.254', 'link-local o metadati cloud'],
    ['::ffff:a9fe:a9fe', 'link-local o metadati cloud'],
    ['::ffff:0.0.0.0', 'indirizzo non specificato'],
    ['::127.0.0.1', 'loopback'],
    ['64:ff9b::7f00:1', 'loopback'],
  ])('rifiuta la forma IPv6 che incorpora un IPv4 vietato: %s', (ip, motivo) => {
    expect(motivoIpVietato(ip)).toBe(motivo);
  });

  it.each([
    ['10.1.2.3'],
    ['172.16.0.5'],
    ['192.168.1.10'],
    ['fd12:3456::1'],
    ['93.184.216.34'],
    ['2606:4700::6810:84e5'],
    ['::ffff:10.0.0.1'],
    ['169.253.255.255'],
    ['128.0.0.1'],
  ])('ammette le reti private e quelle pubbliche: %s', (ip) => {
    expect(motivoIpVietato(ip)).toBeNull();
  });

  it('considera vietato cio\' che non e\' un IP', () => {
    expect(motivoIpVietato('non-un-ip')).toBe('indirizzo non valido');
  });
});

describe('verificaUrlSicuro', () => {
  it('ammette un host pubblico e uno sulla rete privata 10.x', async () => {
    dns.tabella = { 'hook.esempio.it': ['93.184.216.34'], 'interno.lan': ['10.0.0.5'] };

    await expect(verificaUrlSicuro('https://hook.esempio.it/eventi')).resolves.toBeInstanceOf(URL);
    await expect(verificaUrlSicuro('http://interno.lan:8080/webhook')).resolves.toBeInstanceOf(URL);
  });

  it.each([['file:///etc/passwd'], ['ftp://hook.esempio.it/x'], ['gopher://127.0.0.1:25/'], ['non un url']])(
    'rifiuta cio\' che non e\' http(s): %s', async (url) => {
      await expect(verificaUrlSicuro(url)).rejects.toMatchObject({ motivo: 'protocollo' });
    });

  it('rifiuta un nome che risolve in loopback', async () => {
    dns.tabella = { localhost: ['127.0.0.1'] };

    await expect(verificaUrlSicuro('http://localhost:3000/')).rejects.toMatchObject({ motivo: 'vietato', message: expect.stringContaining('loopback') });
  });

  it('rifiuta un nome se anche uno solo dei suoi indirizzi e\' vietato', async () => {
    dns.tabella = { 'misto.esempio.it': ['93.184.216.34', '169.254.169.254'] };

    await expect(verificaUrlSicuro('https://misto.esempio.it/')).rejects.toBeInstanceOf(IndirizzoNonSicuroError);
  });

  it.each([
    ['http://169.254.169.254/latest/meta-data/'],
    ['http://[::1]:8080/'],
    ['http://[::ffff:127.0.0.1]/'],
    ['http://[fe80::1]/'],
    ['http://0.0.0.0/'],
    // Il parser degli URL normalizza le forme abbreviate: 2130706433 e 0x7f.1 sono 127.0.0.1
    ['http://2130706433/'],
    ['http://0x7f.1/'],
  ])('rifiuta gli IP letterali vietati senza interrogare il DNS: %s', async (url) => {
    await expect(verificaUrlSicuro(url)).rejects.toMatchObject({ motivo: 'vietato' });
  });

  it('un host che non risolve e\' un errore "dns", non un indirizzo vietato', async () => {
    await expect(verificaUrlSicuro('https://inesistente.esempio.it/')).rejects.toMatchObject({ motivo: 'dns' });
  });
});

describe('chiamaUrlSicuro', () => {
  it('segue a mano un redirect verso un host ammesso', async () => {
    dns.tabella = { 'idp.esempio.it': ['93.184.216.34'], 'login.esempio.it': ['93.184.216.35'] };
    fetchFinto
      .mockResolvedValueOnce(redirect('https://login.esempio.it/metadata'))
      .mockResolvedValueOnce(new Response('<xml/>', { status: 200 }));

    const risposta = await chiamaUrlSicuro('https://idp.esempio.it/metadata', { timeoutMs: 1000 });

    expect(await risposta.text()).toBe('<xml/>');
    expect(fetchFinto.mock.calls.map(c => c[0])).toEqual(['https://idp.esempio.it/metadata', 'https://login.esempio.it/metadata']);
    expect(fetchFinto.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('non segue un redirect verso un host vietato', async () => {
    dns.tabella = { 'idp.esempio.it': ['93.184.216.34'] };
    fetchFinto.mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data/'));

    await expect(chiamaUrlSicuro('https://idp.esempio.it/metadata')).rejects.toMatchObject({ motivo: 'redirect' });
    expect(fetchFinto).toHaveBeenCalledOnce();
  });

  it(`si ferma dopo ${MASSIMO_REDIRECT} redirect`, async () => {
    dns.tabella = { 'giro.esempio.it': ['93.184.216.34'] };
    fetchFinto.mockImplementation(async () => redirect('https://giro.esempio.it/ancora'));

    await expect(chiamaUrlSicuro('https://giro.esempio.it/')).rejects.toMatchObject({ motivo: 'redirect' });
    expect(fetchFinto).toHaveBeenCalledTimes(MASSIMO_REDIRECT + 1);
  });

  it('non contatta un indirizzo vietato', async () => {
    await expect(chiamaUrlSicuro('http://127.0.0.1:5432/')).rejects.toMatchObject({ motivo: 'vietato' });
    expect(fetchFinto).not.toHaveBeenCalled();
  });
});

describe('leggiCorpoLimitato', () => {
  it('legge un corpo entro il limite', async () => {
    await expect(leggiCorpoLimitato(new Response('ciao'), 10)).resolves.toBe('ciao');
  });

  it('rifiuta un corpo oltre il limite, anche senza Content-Length', async () => {
    const flusso = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    });

    await expect(leggiCorpoLimitato(new Response(flusso), 10)).rejects.toBeInstanceOf(CorpoTroppoGrandeError);
  });

  it('rifiuta subito un Content-Length oltre il limite', async () => {
    const risposta = new Response('x'.repeat(20), { headers: { 'content-length': '20' } });

    await expect(leggiCorpoLimitato(risposta, 10)).rejects.toBeInstanceOf(CorpoTroppoGrandeError);
  });

  it('con tronca restituisce l\'inizio del corpo', async () => {
    await expect(leggiCorpoLimitato(new Response('abcdefghij'), 4, { tronca: true })).resolves.toBe('abcd');
  });
});
