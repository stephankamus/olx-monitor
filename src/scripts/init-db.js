const config = require('../config')
const $logger = require('../components/Logger')
const { pool, init } = require('../database/database')
const buscaRepository = require('../repositories/buscaRepository')

/**
 * Aplica o schema olx_monitor_* e, se a tabela estiver vazia,
 * cria as buscas de seed. Uso: npm run db:init
 */
const main = async () => {
  await init()
  $logger.info('Schema olx_monitor_* aplicado')

  const criadas = await buscaRepository.seed(config.urls, 1, config.defaultIntervalMinutes)
  $logger.info(`Buscas existentes: ${await buscaRepository.contar()} (criadas neste seed: ${criadas})`)

  await pool.end()
}

main().catch(async (error) => {
  $logger.error({ err: error.message }, 'Falha ao inicializar o banco')
  try {
    await pool.end()
  } catch (_) { /* ignore */ }
  process.exit(1)
})
