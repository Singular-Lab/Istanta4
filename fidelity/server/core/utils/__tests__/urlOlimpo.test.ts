import { describe, expect, it } from 'vitest';
import { inUrlOlimpoRelativo, riscriviUrlOlimpo, urlOlimpo } from '../urlOlimpo';

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
