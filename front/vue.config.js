const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  // Avoid native watcher exhaustion (EMFILE) on macOS; retain source hot reload.
  configureWebpack: {
    watchOptions: { poll: 1000, ignored: /node_modules/ }
  },
  devServer: {
    host: '127.0.0.1', port: 8080,
    static: { watch: { usePolling: true, interval: 1000 } },
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } }
  },

  pluginOptions: {
    vuetify: {
			// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
		}
  }
})
