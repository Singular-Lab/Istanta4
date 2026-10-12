import { describe, expect, it } from 'vitest';
import { guidDaRiferimentoOlimpo, inUrlOlimpoRelativo, isUrlOlimpo, riscriviUrlOlimpo, urlFotoOlimpo, urlOlimpo, urlOlimpoPubblico } from '../urlOlimpo';

describe('URL Olimpo per il browser', () => {
  it('costruisce URL relativi al proxy, con la query codificata', () => {
    expect(urlOlimpo('/foto/getThumbNailOnDemand', { guidId: 'a b', performante: true, height: undefined }))
      .toBe('/olimpo/foto/getThumbNailOnDemand?guidId=a+b&performante=true');
  });

  it('converte un URL assoluto di Olimpo, con qualunque host, nella forma relativa', () => {
    expect(inUrlOlimpoRelativo('http://olimpo:3000/materiali/getMaterialePDF?id=x1'))
      .toBe('/olimpo/materiali/getMaterialePDF?id=x1');
    expect(inUrlOlimpoRelativo('https://cdn.esempio.it:3300/foto/getThumbNailOnDemand?guidId=g&performante=true'))
      .toBe('/olimpo/foto/getThumbNailOnDemand?guidId=g&performante=true');
  });

  it('riconosce l endpoint anche quando Olimpo sta dietro un gateway con un percorso', () => {
    expect(inUrlOlimpoRelativo('http://localhost:4000/olimpo/materiali/getThumbnailMaterialePdfs?&id=db29ea15&page=1'))
      .toBe('/olimpo/materiali/getThumbnailMaterialePdfs?&id=db29ea15&page=1');
    expect(inUrlOlimpoRelativo('https://gateway.esempio.it/a/b/foto/getThumbNailOnDemand?guidId=g'))
      .toBe('/olimpo/foto/getThumbNailOnDemand?guidId=g');
  });

  it.each([
    'http://localhost:4000/olimpo/xmateriali/getMaterialePDF?id=1',
    'http://localhost:4000/olimpo/materiali/getMaterialePDF/altro?id=1',
    'https://www.google.com/maps?q=1',
    'http://olimpo:3000/materiali/uploadMateriale',
    'non un url',
    'data:image/png;base64,AAAA',
  ])('lascia stare %s', (url) => {
    expect(inUrlOlimpoRelativo(url)).toBeNull();
  });

  it('riscrive gli URL annidati e conta le modifiche, senza toccare il resto', () => {
    const meta = {
      documents: [{ id_olimpo_cloud: 'd1', download_url: 'http://olimpo:3000/materiali/getMaterialePDF?id=d1' }],
      videos: [
        { guid_id: 'v1', url: '/olimpo/materiali/getVideoOnDemand?guidId=v1' },
        { guid_id: 'v2', url: 'http://localhost:4000/olimpo/materiali/getVideoOnDemand?guidId=v2' },
      ],
      sito: 'https://www.esempio.it',
    };

    const { valore, modifiche } = riscriviUrlOlimpo(meta);

    expect(modifiche).toBe(2);
    expect(valore.documents[0].download_url).toBe('/olimpo/materiali/getMaterialePDF?id=d1');
    expect(valore.videos[0].url).toBe('/olimpo/materiali/getVideoOnDemand?guidId=v1');
    expect(valore.videos[1].url).toBe('/olimpo/materiali/getVideoOnDemand?guidId=v2');
    expect(valore.sito).toBe('https://www.esempio.it');
  });

  it('senza URL da riscrivere restituisce lo stesso valore', () => {
    const valore = { a: ['x'] };
    expect(riscriviUrlOlimpo(valore)).toEqual({ valore, modifiche: 0 });
    expect(riscriviUrlOlimpo(valore).valore).toBe(valore);
  });
});

describe('URL Olimpo per chi sta fuori da Fidelity e riferimenti salvati', () => {
  it('urlOlimpoPubblico antepone l indirizzo pubblico di Fidelity, conservandone il percorso', () => {
    expect(urlOlimpoPubblico('https://fidelity.esempio.it/', '/materiali/getThumbnailMaterialePdfs', { id: 'f1' }))
      .toBe('https://fidelity.esempio.it/olimpo/materiali/getThumbnailMaterialePdfs?id=f1');
    expect(urlOlimpoPubblico('https://esempio.it/fidelity', '/materiali/getMaterialePDF', { id: 'f1' }))
      .toBe('https://esempio.it/fidelity/olimpo/materiali/getMaterialePDF?id=f1');
  });

  it.each([
    ['/olimpo/foto/getThumbNailOnDemand?guidId=g1', true],
    ['http://olimpo:3000/foto/getThumbNailOnDemand?guidId=g1', true],
    ['3f2a9c1e-guid', false],
    ['', false],
  ])('isUrlOlimpo(%s) = %s', (valore, atteso) => {
    expect(isUrlOlimpo(valore)).toBe(atteso);
  });

  it.each([
    ['g1', 'g1'],
    ['/olimpo/foto/getThumbNailOnDemand?guidId=g2&performante=true', 'g2'],
    ['http://localhost:4000/olimpo/foto/getThumbNailOnDemand?guidId=g3', 'g3'],
    ['http://olimpo:3000/materiali/getMaterialePDF?id=p1', 'p1'],
    ['https://cdn.esempio.it/immagine.png', 'https://cdn.esempio.it/immagine.png'],
  ])('guidDaRiferimentoOlimpo(%s) = %s', (valore, atteso) => {
    expect(guidDaRiferimentoOlimpo(valore)).toBe(atteso);
  });

  it('urlFotoOlimpo costruisce la miniatura da un GUID o da un URL Olimpo gia salvato, senza avvolgerlo due volte', () => {
    const atteso = '/olimpo/foto/getThumbNailOnDemand?guidId=g1&performante=true';
    expect(urlFotoOlimpo('g1', { performante: true })).toBe(atteso);
    expect(urlFotoOlimpo('http://olimpo:3000/foto/getThumbNailOnDemand?guidId=g1', { performante: true })).toBe(atteso);
    expect(urlFotoOlimpo(atteso, { performante: true })).toBe(atteso);
  });

  it('urlFotoOlimpo lascia invariata un immagine che non sta su Olimpo', () => {
    expect(urlFotoOlimpo('https://cdn.esempio.it/immagine.png')).toBe('https://cdn.esempio.it/immagine.png');
  });

  it('urlFotoOlimpo con baseFidelity restituisce l URL pubblico', () => {
    expect(urlFotoOlimpo('g1', { baseFidelity: 'https://fidelity.esempio.it' }))
      .toBe('https://fidelity.esempio.it/olimpo/foto/getThumbNailOnDemand?guidId=g1');
  });
});
