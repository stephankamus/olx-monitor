const config = require('../config')
const { query } = require('../database/database')
const $logger = require('../components/Logger')

/**
 * Token do bot: preferência para a tabela chats_telegram (mesma base do
 * BackEnd-SiteCasa), com fallback para TELEGRAM_TOKEN do .env.
 */
const obterToken = async () => {
  try {
    const result = await query(
      `SELECT token
         FROM chats_telegram
        WHERE deletado = false
          AND coalesce(token, '') <> ''
        ORDER BY id
        LIMIT 1`
    )

    if (result.rowCount > 0) return result.rows[0].token
  } catch (error) {
    $logger.warn({ err: error.message }, 'Não foi possível ler chats_telegram; usando TELEGRAM_TOKEN')
  }

  return config.telegramToken || null
}

/**
 * Destinatários: usuarios.chatid_telegram (somente ativos).
 * Se idUsuario for informado, restringe ao dono da busca.
 */
const obterDestinatarios = async (idUsuario = null) => {
  try {
    const params = []
    let filtroUsuario = ''

    if (idUsuario) {
      params.push(idUsuario)
      filtroUsuario = 'AND id = $1'
    }

    const result = await query(
      `SELECT chatid_telegram AS chat_id
         FROM usuarios
        WHERE ativo = true
          AND coalesce(chatid_telegram, '') <> ''
          ${filtroUsuario}`,
      params
    )

    const ids = result.rows.map((row) => String(row.chat_id).trim()).filter(Boolean)
    if (ids.length) return ids
  } catch (error) {
    $logger.warn({ err: error.message }, 'Não foi possível ler usuarios.chatid_telegram; usando TELEGRAM_CHAT_ID')
  }

  return config.telegramChatID ? [String(config.telegramChatID).trim()] : []
}

const obterConfig = async (chave, fallback = null) => {
  try {
    const result = await query('SELECT valor FROM olx_monitor_config WHERE chave = $1', [chave])
    return result.rowCount > 0 ? result.rows[0].valor : fallback
  } catch (error) {
    $logger.warn({ err: error.message, chave }, 'Falha ao ler olx_monitor_config')
    return fallback
  }
}

const definirConfig = async (chave, valor) => {
  await query(
    `INSERT INTO olx_monitor_config (chave, valor)
     VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [chave, valor === null || valor === undefined ? null : String(valor)]
  )
}

const obterIntervaloPadrao = async () => {
  const valor = await obterConfig('intervalo_padrao_minutos')
  const minutos = Number.parseInt(valor, 10)
  return Number.isNaN(minutos) ? config.defaultIntervalMinutes : minutos
}

module.exports = {
  obterToken,
  obterDestinatarios,
  obterConfig,
  definirConfig,
  obterIntervaloPadrao
}
