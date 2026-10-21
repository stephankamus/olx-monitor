const config = require('../config')
const $logger = require('./Logger.js')
const { getCycleTLSInstance } = require('./CycleTls')
const { requestsFingerprints } = require('../requestsFingerprints.js')

const headers = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache'
}

/**
 * GET com fingerprint TLS aleatório (cycletls), para reduzir bloqueio do Cloudflare.
 * Retorna o HTML ou lança erro — quem chama precisa distinguir
 * "sem anúncios" de "bloqueado".
 */
const httpClient = async (url) => {
  const cycleTLS = await getCycleTLSInstance()
  if (!cycleTLS) {
    throw new Error('CycleTLS não inicializado')
  }

  const fingerprint = requestsFingerprints[Math.floor(Math.random() * requestsFingerprints.length)]

  const response = await cycleTLS(
    url,
    {
      userAgent: fingerprint[0],
      ja3: fingerprint[1],
      headers,
      timeout: config.requestTimeoutMs
    },
    'get'
  )

  if (!response || !response.status) {
    throw new Error('Requisição sem resposta')
  }

  if (response.status !== 200) {
    $logger.warn({ status: response.status, url }, 'OLX respondeu com status inesperado')
    throw new Error(`OLX respondeu ${response.status}`)
  }

  return response.body
}

module.exports = httpClient
