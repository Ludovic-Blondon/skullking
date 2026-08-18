module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      // Les migrations Drizzle sont importées depuis `drizzle/migrations.js`
      // comme des fichiers `.sql` : ce plugin en inline le contenu au build,
      // sinon Metro tente de les parser comme du JavaScript.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
