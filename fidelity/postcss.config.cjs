module.exports = {
  plugins: [
    require("postcss-import"),
    require("postcss-simple-vars"),
    require("tailwindcss/nesting"),
    require("tailwindcss"),
    require("autoprefixer"),
  ],
};
