const config = require('../config')
const $logger = require('./Logger')
const adRepository = require('../repositories/adRepository')
const notifier = require('./Notifier')

class Ad {

  constructor ({ buscaId, anuncioId, titulo, preco, url, apelido, idUsuario, deveNotificar }) {
    this.buscaId = buscaId
    this.anuncioId = anuncioId
    this.titulo = titulo
    this.preco = preco
    this.url = url
    this.apelido = apelido
    this.idUsuario = idUsuario
    this.deveNotificar = deveNotificar
    this.valid = false
  }

  /**
   * Persiste o anúncio e retorna o que mudou.
   * @returns {Promise<{novo: boolean, precoAlterado: boolean, notificado: boolean}>}
   */
  process = async () => {
    if (!this.isValidAd()) {
      $logger.debug({ anuncioId: this.anuncioId }, 'Anúncio inválido, ignorado')
      return { novo: false, precoAlterado: false, notificado: false }
    }

    const existente = await adRepository.buscar(this.buscaId, this.anuncioId)

    if (!existente) {
      return this.criarAnuncio()
    }

    if (Number(existente.preco) === Number(this.preco)) {
      await adRepository.registrarVisto(this.buscaId, this.anuncioId)
      return { novo: false, precoAlterado: false, notificado: false }
    }

    return this.atualizarPreco(existente)
  }

  criarAnuncio = async () => {
    await adRepository.criar({
      buscaId: this.buscaId,
      anuncioId: this.anuncioId,
      titulo: this.titulo,
      preco: this.preco,
      url: this.url
    })

    await adRepository.salvarHistoricoPreco({
      buscaId: this.buscaId,
      anuncioId: this.anuncioId,
      preco: this.preco
    })

    $logger.info({ anuncioId: this.anuncioId, preco: this.preco }, 'Novo anúncio salvo')

    // Na primeira execução de uma busca não notificamos, mas registramos o
    // preço como baseline para futuras quedas.
    if (!this.deveNotificar) {
      await adRepository.marcarNotificado(this.buscaId, this.anuncioId, this.preco)
      return { novo: true, precoAlterado: false, notificado: false }
    }

    const enviado = await notifier.sendNotification(
      notifier.mensagemNovoAnuncio({
        apelido: this.apelido,
        titulo: this.titulo,
        preco: this.preco,
        url: this.url
      }),
      { idUsuario: this.idUsuario }
    )

    if (enviado.enviados > 0) {
      await adRepository.marcarNotificado(this.buscaId, this.anuncioId, this.preco)
    }

    return { novo: true, precoAlterado: false, notificado: enviado.enviados > 0 }
  }

  atualizarPreco = async (existente) => {
    await adRepository.atualizarPreco({
      buscaId: this.buscaId,
      anuncioId: this.anuncioId,
      titulo: this.titulo,
      preco: this.preco,
      url: this.url
    })

    await adRepository.salvarHistoricoPreco({
      buscaId: this.buscaId,
      anuncioId: this.anuncioId,
      preco: this.preco
    })

    $logger.info(
      { anuncioId: this.anuncioId, de: existente.preco, para: this.preco },
      'Preço alterado'
    )

    // Só interessa queda de preço, e nunca repete o mesmo alerta.
    if (Number(this.preco) >= Number(existente.preco)) {
      return { novo: false, precoAlterado: true, notificado: false }
    }

    const base = existente.precoNotificado ?? existente.preco
    const percentual = Math.abs(Math.round(((this.preco - base) / base) * 100))

    if (Number(this.preco) >= Number(base)) {
      return { novo: false, precoAlterado: true, notificado: false }
    }

    if (percentual < config.minDropPercent) {
      $logger.debug(
        { anuncioId: this.anuncioId, percentual, minimo: config.minDropPercent },
        'Queda abaixo do mínimo configurado, sem notificação'
      )
      return { novo: false, precoAlterado: true, notificado: false }
    }

    const enviado = await notifier.sendNotification(
      notifier.mensagemQuedaPreco({
        apelido: this.apelido,
        titulo: this.titulo,
        precoAnterior: base,
        preco: this.preco,
        percentual,
        url: this.url
      }),
      { idUsuario: this.idUsuario }
    )

    if (enviado.enviados > 0) {
      await adRepository.marcarNotificado(this.buscaId, this.anuncioId, this.preco)
    }

    return { novo: false, precoAlterado: true, notificado: enviado.enviados > 0 }
  }

  // A listagem do OLX mistura blocos que não são anúncios
  isValidAd = () => {
    this.valid = Boolean(this.anuncioId && this.url && Number.isFinite(Number(this.preco)) && Number(this.preco) > 0)
    return this.valid
  }
}

module.exports = Ad
