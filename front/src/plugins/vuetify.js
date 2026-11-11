import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { colors } from '../design/tokens'
export default createVuetify({ theme: { defaultTheme: 'platform', themes: { platform: { dark: false, colors } } }, defaults: { VBtn: { rounded: 'lg', elevation: 0, style: 'text-transform:none;letter-spacing:0;font-weight:650' }, VCard: { rounded: 'xl', elevation: 0 } } })
