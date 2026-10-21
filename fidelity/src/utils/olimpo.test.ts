import { describe, expect, it } from 'vitest';
import { guidIdDaUrlOlimpo } from './olimpo';

describe('guidIdDaUrlOlimpo', () => {
  it.each([
    ['/olimpo/foto/getThumbNailOnDemand?guidId=g1&performante=true', 'g1'],
    ['http://olimpo:3000/foto/getThumbNailOnDemand?guidId=g2', 'g2'],
    ['https://fidelity.esempio.it/olimpo/foto/getThumbNailOnDemand?performante=true&guidId=g3', 'g3'],
  ])('legge il guidId da %s', (url, atteso) => {
    expect(guidIdDaUrlOlimpo(url, 'https://fidelity.esempio.it')).toBe(atteso);
  });

  it('senza guidId restituisce null', () => {
    expect(guidIdDaUrlOlimpo('/olimpo/materiali/getMaterialePDF?id=x', 'https://fidelity.esempio.it')).toBeNull();
  });
});
