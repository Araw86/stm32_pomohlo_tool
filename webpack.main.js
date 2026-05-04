/**
 * configuration for main part of webpack
 */

const path = require('path');

const { IgnorePlugin } = require('webpack');

/* ignore fsevents module which caused error in electron  */
const optionalPlugins = [];
if (process.platform !== "darwin") {
  optionalPlugins.push(new IgnorePlugin({ resourceRegExp: /^fsevents$/ }));
}


module.exports =
{
  entry: './src/main/main.ts',
  target: 'electron-main',
  module: {
    rules: [{
      test: /\.ts$/,
      include: [path.resolve(__dirname, 'src/main'), path.resolve(__dirname, 'src/shared')],
      use: [{ loader: 'ts-loader' }]
    }]
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node', '...'],
  },
  output: {
    path: path.resolve(__dirname, 'build', 'main'),
    //clean: true
  },
  plugins: [
    ...optionalPlugins,
  ],
  externals: {
    sqlite3: 'commonjs sqlite3',
  },
}