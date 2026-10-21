require('dotenv').config()

// Este arquivo é apenas BOOTSTRAP.
// Tudo que muda em runtime (URLs monitoradas, intervalo, ativação) vive no Postgres,
// nas tabelas olx_monitor_*. Aqui só ficam parâmetros de infraestrutura.

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const toList = (value) => (value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const config = {}

// Infra
config.databaseUrl = process.env.DATABASE_URL || ''
config.logLevel = process.env.LOG_LEVEL || 'info'
config.logFile = process.env.LOG_FILE || ''

// Loop de execução
config.tickSeconds = toInt(process.env.TICK_SECONDS, 60)
config.defaultIntervalMinutes = toInt(process.env.DEFAULT_INTERVAL_MINUTES, 360)
config.jitterMinSeconds = toInt(process.env.JITTER_MIN_SECONDS, 5)
config.jitterMaxSeconds = toInt(process.env.JITTER_MAX_SECONDS, 12)

// Scraper
config.maxPages = toInt(process.env.MAX_PAGES, 100)
config.requestTimeoutMs = toInt(process.env.REQUEST_TIMEOUT_MS, 30000)

// Notificação: um anúncio só alerta se o preço cair ao menos este percentual
// em relação ao último preço notificado (0 = qualquer queda).
config.minDropPercent = toInt(process.env.MIN_DROP_PERCENT, 0)

// Fallback de Telegram, usado só enquanto não existir token/chat no banco
// (chats_telegram / usuarios.chatid_telegram).
config.telegramToken = process.env.TELEGRAM_TOKEN || ''
config.telegramChatID = process.env.TELEGRAM_CHAT_ID || ''

// Seed: usado somente quando a tabela olx_monitor_busca está vazia.
// Depois disso, adicione/remova buscas pelo bot do Telegram.
config.urls = process.env.SEED_URLS
  ? toList(process.env.SEED_URLS)
  : [
      'https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/hyundai/azera/estado-mg/belo-horizonte-e-regiao?pe=32000&re=2011',
      'https://www.olx.com.br/autos-e-pecas/motos/kasinski/comet/250/estado-mg/belo-horizonte-e-regiao?pe=13000',
      'https://www.olx.com.br/games/consoles-de-video-game?ps=1000&pe=1800&q=playstation%20vr2&opst=2'
    ]

module.exports = config
