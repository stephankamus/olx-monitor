const cheerio = require('cheerio')

/**
 * Extrai a lista de anúncios do HTML de uma página de busca do OLX.
 * O OLX já usou <script id="__NEXT_DATA__"> e hoje usa o payload RSC
 * (self.__next_f.push) — os dois formatos são suportados.
 *
 * Função pura (sem banco/rede) para poder ser testada isoladamente.
 * @returns {Array|null} lista de anúncios ou null quando a página não tem payload
 */
const extrairAnuncios = (html) => {
  const $ = cheerio.load(html)
  return extrairAnunciosDeDocumento($)
}

const extrairAnunciosDeDocumento = ($) => {
  const script = $('script[id="__NEXT_DATA__"]').text()

  if (script) {
    return JSON.parse(script).props.pageProps.ads
  }

  const flightScript = $('script:not([src])').toArray()
    .map((element) => $(element).text())
    .find((content) => content.includes('listId'))

  // Depois da última página o OLX devolve uma página válida, sem payload de anúncios.
  if (!flightScript) return null

  const matchPush = flightScript.match(/^self\.__next_f\.push\((.*)\)\s*$/s)
  if (!matchPush) return null

  const payload = JSON.parse(matchPush[1])[1]
  const matchAds = payload.match(/"ads":(\[.*\]),"searchBoxProps":/s)
  if (!matchAds) return null

  return JSON.parse(matchAds[1])
}

const precoDoAnuncio = (advert) => {
  const raw = advert.price ?? advert.priceValue ?? '0'
  return Number.parseInt(String(raw).replace(/\D/g, '') || '0', 10)
}

module.exports = { extrairAnuncios, extrairAnunciosDeDocumento, precoDoAnuncio }
