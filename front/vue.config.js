const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: { host: '127.0.0.1', port: 8080, proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } } },

  pluginOptions: {
    vuetify: {
			// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
		}
  }
})
