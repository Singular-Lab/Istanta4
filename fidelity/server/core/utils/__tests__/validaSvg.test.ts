import { describe, expect, it } from 'vitest';
import { motivoSvgNonValido } from '../validaSvg';

describe('validazione icona SVG', () => {
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" style="fill:red"/></svg>',
    '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="p" d="M0 0"/></defs><use xlink:href="#p"/></svg>',
  ])('accetta un SVG statico', (svg) => {
    expect(motivoSvgNonValido(svg)).toBeNull();
  });

  it.each([
    ['script', '<svg><script>alert(1)</script></svg>'],
    ['onload', '<svg onload="alert(1)"></svg>'],
    ['javascript:', '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'],
    ['foreignObject', '<svg><foreignObject><div>x</div></foreignObject></svg>'],
    ['href esterno', '<svg><image href="https://esempio.it/x.png"/></svg>'],
    ['ENTITY', '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>'],
    ['@import', '<svg><style>@import url(https://esempio.it/a.css);</style></svg>'],
    ['non svg', '<html><body></body></html>'],
  ])('rifiuta un SVG con %s', (_caso, svg) => {
    expect(motivoSvgNonValido(svg)).not.toBeNull();
  });
});
