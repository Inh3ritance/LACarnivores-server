const webpack = require('webpack');

module.exports = {
    target: 'node',
    plugins: [
      new webpack.DefinePlugin({ 'global.GENTLY': false }),
    ],
}