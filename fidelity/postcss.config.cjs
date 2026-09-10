module.exports = {
  plugins: [
    require("postcss-import"),
    require("postcss-simple-vars"),
    require("tailwindcss/nesting"),
    require("tailwindcss"),
    require("autoprefixer"),
    // Aggiungi il prefisso wp- solo alle classi personalizzate (non Tailwind)
    /*require("postcss-prefix-selector")({
      prefix: "wp-",
      exclude: [/^html/, /^body/, /^\.wp-/, /^\.tailwind/, /^\.dark/, /^\.light/],
      transform: (prefix, selector) => {
        if (selector.includes('wp-') || selector.includes('tailwind')) {
          return selector;
        }
        return selector.replace(/(\.[\w-]+)/g, (match) => {
          return `.${prefix}${match.slice(1)}`;
        });
      }
    })*/,
    // Offusca tutte le classi CSS in produzione (incluse Tailwind e wp-)
   
  ].filter(Boolean), // Rimuove i plugin falsy (quando NODE_ENV !== 'production')
};
