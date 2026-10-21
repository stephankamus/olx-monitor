const config = require('./config')
const $logger = require('./components/Logger')
const { pool, init, tryLock, unlock } = require('./database/database')
const { initializeCycleTLS, exitCycleTLS } = require('./components/CycleTls')
const { scrapeBusca } = require('./components/Scraper')
const buscaRepository = require('./repositories/buscaRepository')
const scrapperRepository = require('./repositories/scrapperRepository')

let executando = false
let parando = false

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const jitter = () => {
  const min = Math.max(0, config.jitterMinSeconds)
  const max = Math.max(min, config.jitterMaxSeconds)
  const segundos = min + Math.floor(Math.random() * (max - min + 1))
  return sleep(segundos * 1000)
}

const executarBusca = async (busca) => {
  const inicio = Date.now()
  await buscaRepository.iniciarExecucao(busca.id)

  try {
    // Primeira execução de uma busca não notifica (evita flood de anúncios antigos)
    const deveNotificar = await scrapperRepository.houveExecucaoAnterior(busca.id)

    const stats = await scrapeBusca(busca, { deveNotificar })

    await scrapperRepository.salvarExecucao({
      buscaId: busca.id,
      sucesso: true,
      anunciosEncontrados: stats.validAds,
      anunciosNovos: stats.anunciosNovos,
      paginasLidas: stats.paginasLidas,
      precoMinimo: stats.precoMinimo,
      precoMaximo: stats.precoMaximo,
      precoMedio: stats.precoMedio,
      duracaoMs: stats.duracaoMs
    })

    await buscaRepository.concluirExecucao({
      id: busca.id,
      sucesso: true,
      status: stats.completa ? 'ok' : 'parcial',
      anuncios: stats.validAds
    })
  } catch (error) {
    const mensagem = String(error.message || error).slice(0, 500)
    $logger.error({ err: mensagem, buscaId: busca.id, url: busca.url }, 'Falha na busca')

    try {
      await scrapperRepository.salvarExecucao({
        buscaId: busca.id,
        sucesso: false,
        duracaoMs: Date.now() - inicio,
        erro: mensagem
      })

      await buscaRepository.concluirExecucao({
        id: busca.id,
        sucesso: false,
        status: 'erro',
        erro: mensagem
      })
    } catch (erroPersistencia) {
      $logger.error({ err: erroPersistencia.message }, 'Falha ao registrar erro da busca')
    }
  }
}

const rodada = async () => {
  if (executando || parando) return
  executando = true

  let locked = false
  try {
    locked = await tryLock()
    if (!locked) {
      $logger.warn('Outra instância está executando uma rodada; ignorando este tick')
      return
    }

    const buscas = await buscaRepository.pendentes(10)
    if (!buscas.length) return

    $logger.info({ total: buscas.length }, 'Buscas pendentes')

    for (const busca of buscas) {
      if (parando) break
      await executarBusca(busca)
      await jitter()
    }
  } catch (error) {
    $logger.error({ err: error.message }, 'Erro na rodada')
  } finally {
    if (locked) await unlock()
    executando = false
  }
}

const main = async () => {
  $logger.info(
    {
      tickSeconds: config.tickSeconds,
      intervaloPadrao: config.defaultIntervalMinutes,
      maxPages: config.maxPages
    },
    'Programa iniciado'
  )

  await init()
  $logger.info('Schema olx_monitor_* verificado')

  await buscaRepository.seed(config.urls, 1, config.defaultIntervalMinutes)
  await initializeCycleTLS()

  await rodada()

  const timer = setInterval(rodada, Math.max(15, config.tickSeconds) * 1000)
  return timer
}

const encerrar = async (sinal) => {
  if (parando) return
  parando = true
  $logger.info({ sinal }, 'Encerrando')

  try {
    exitCycleTLS()
  } catch (error) {
    $logger.warn({ err: error.message }, 'Falha ao encerrar CycleTLS')
  }

  try {
    await pool.end()
  } catch (error) {
    $logger.warn({ err: error.message }, 'Falha ao encerrar pool do Postgres')
  }

  process.exit(0)
}

process.on('SIGINT', () => encerrar('SIGINT'))
process.on('SIGTERM', () => encerrar('SIGTERM'))
process.on('unhandledRejection', (error) => {
  $logger.error({ err: error && error.message ? error.message : String(error) }, 'Promise rejeitada sem tratamento')
})

main().catch(async (error) => {
  $logger.error({ err: error.message }, 'Falha na inicialização')
  await encerrar('erro-fatal')
})
