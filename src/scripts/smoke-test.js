/**
 * Smoke test da imagem: valida que o binário do cycletls carrega e inicializa
 * (é um binário Go copiado de outra etapa do build).
 * Não acessa banco nem o OLX. Uso: node scripts/smoke-test.js
 */
const { initializeCycleTLS, exitCycleTLS } = require('../components/CycleTls')

const main = async () => {
  await initializeCycleTLS()
  console.log('cycletls ok')

  try {
    exitCycleTLS()
  } catch (_) {
    // ignore
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('cycletls falhou:', error && error.message ? error.message : error)
  process.exit(1)
})
