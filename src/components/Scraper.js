const config = require('../config')
const $logger = require('./Logger')
const $httpClient = require('./HttpClient.js')
const { extrairAnuncios, precoDoAnuncio } = require('./OlxParser')
const adRepository = require('../repositories/adRepository')
const Ad = require('./Ad.js')

// O OLX serve no máximo 100 páginas: além disso ele repete a última.
const MAX_PAGES = config.maxPages

const setUrlParam = (url, param, value) => {
  const newUrl = new URL(url)
  const searchParams = newUrl.searchParams
  searchParams.set(param, value)
  newUrl.search = searchParams.toString()
  return newUrl.toString()
}

/**
 * Executa o scraping de uma busca e persiste o resultado.
 * Lança exceção quando a página não pôde ser obtida (403, timeout, etc.),
 * para que a rodada seja registrada como erro em vez de "anúncio sumiu".
 */
const scrapeBusca = async (busca, { deveNotificar = false } = {}) => {
  const inicio = Date.now()
  const url = busca.url
  const searchTerm = new URL(url).searchParams.get('q') || ''

  const seenIds = new Set()
  const idsPresentes = []

  let page = 1
  let validAds = 0
  let anunciosNovos = 0
  let paginasLidas = 0
  let minPrice = null
  let maxPrice = null
  let sumPrices = 0
  let completa = false

  $logger.info({ buscaId: busca.id, url }, 'Iniciando busca')

  while (page <= MAX_PAGES) {
    const currentUrl = setUrlParam(url, 'o', page)
    const body = await $httpClient(currentUrl)

    if (!body || typeof body !== 'string') {
      throw new Error(`Não foi possível obter a página ${page} (bloqueio, timeout ou erro HTTP)`)
    }

    paginasLidas++

    let adList = extrairAnuncios(body)

    if (!adList || !Array.isArray(adList) || !adList.length) {
      completa = true
      break
    }

    // Nenhum anúncio novo => resultados esgotados
    adList = adList.filter((advert) => !seenIds.has(advert.listId))

    if (!adList.length) {
      completa = true
      break
    }

    for (const advert of adList) {
      seenIds.add(advert.listId)
      idsPresentes.push(advert.listId)

      const preco = precoDoAnuncio(advert)

      const ad = new Ad({
        buscaId: busca.id,
        anuncioId: advert.listId,
        titulo: advert.subject,
        preco,
        url: advert.url,
        apelido: busca.apelido,
        idUsuario: busca.idUsuario,
        deveNotificar
      })

      const resultado = await ad.process()

      if (!ad.valid) continue

      validAds++
      sumPrices += preco
      anunciosNovos += resultado.novo ? 1 : 0

      if (minPrice === null || preco < minPrice) minPrice = preco
      if (maxPrice === null || preco > maxPrice) maxPrice = preco
    }

    page++
  }

  if (!completa && paginasLidas >= MAX_PAGES) {
    $logger.warn({ buscaId: busca.id }, `Limite de ${MAX_PAGES} páginas atingido`)
  }

  // Só marca ausentes quando a varredura foi completa e encontrou algo:
  // evita "todos sumiram" em rodada com bloqueio parcial.
  let ausentes = 0
  if (completa && validAds > 0) {
    ausentes = await adRepository.marcarAusentes(busca.id, idsPresentes)
  }

  const estatisticas = {
    searchTerm,
    validAds,
    anunciosNovos,
    paginasLidas,
    completa,
    ausentes,
    precoMinimo: minPrice,
    precoMaximo: maxPrice,
    precoMedio: validAds ? Number((sumPrices / validAds).toFixed(2)) : null,
    duracaoMs: Date.now() - inicio
  }

  $logger.info({ buscaId: busca.id, ...estatisticas }, 'Busca concluída')

  return estatisticas
}

module.exports = { scrapeBusca }
