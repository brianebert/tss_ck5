module.exports = {
  resolve: {
    //modules: [...],
    fallback: {
      "fs": false,
      "url": false,
      "tls": false,
      "net": false,
      "util": false,
      "zlib": false,
      "http": false,
      "https": false,
      "stream": false,
      "buffer": require.resolve('buffer/'),
      "events": require.resolve("events/"),
      "path": require.resolve("path-browserify"),
      "crypto": require.resolve('crypto-browserify'),
      "crypto-browserify": require.resolve('crypto-browserify')
    } 
  },
  mode: 'development',
  entry: {
  	client: './cke5.js',
  },/*
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          extractComments: 'all',
          compress: {
            drop_console: true,
          },
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
	},*/
  output: {
    filename: '[name].js',
    path: __dirname
  },
  "experiments": {
    "topLevelAwait": true
  }
};
