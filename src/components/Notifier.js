const axios = require('axios')
const $logger = require('./Logger')
const telegramRepository = require('../repositories/telegramRepository')

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&')
  .replace(/</g, '<')
  .replace(/>/g, '>')

const enviarParaChat = async (token, chatId, texto) => {
  await axios.get(`https://api.telegram.org/bot${token}/sendMessage`, {
    params: {
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    },
    timeout: 10000
  })
}

/**
 * Envia a mensagem para todos os destinatários configurados
 * (usuarios.chatid_telegram, restrito ao dono da busca quando informado).
 */
const sendNotification = async (texto, { idUsuario = null } = {}) => {
  const token = await telegramRepository.obterToken()
  if (!token) {
    $logger.warn('Nenhum token do Telegram disponível; notificação ignorada')
    return { enviados: 0 }
  }

  const destinatarios = await telegramRepository.obterDestinatarios(idUsuario)
  if (!destinatarios.length) {
    $logger.warn('Nenhum destinatário do Telegram configurado; notificação ignorada')
    return { enviados: 0 }
  }

  let enviados = 0
  for (const chatId of destinatarios) {
    try {
      await enviarParaChat(token, chatId, texto)
      enviados++
    } catch (error) {
      const detalhe = error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message
      $logger.error({ err: detalhe, chatId }, 'Falha ao enviar notificação pelo Telegram')
    }
  }

  return { enviados }
}

const mensagemNovoAnuncio = ({ apelido, titulo, preco, url }) =>
  [
    '🆕 <b>Novo anúncio</b>',
    apelido ? `<i>${escapeHtml(apelido)}</i>` : null,
    `${escapeHtml(titulo)}`,
    `<b>R$ ${Number(preco).toLocaleString('pt-BR')}</b>`,
    `<a href="${escapeHtml(url)}">Abrir anúncio</a>`
  ].filter(Boolean).join('\n')

const mensagemQuedaPreco = ({ apelido, titulo, precoAnterior, preco, percentual, url }) =>
  [
    `📉 <b>Queda de preço: ${percentual}%</b>`,
    apelido ? `<i>${escapeHtml(apelido)}</i>` : null,
    `${escapeHtml(titulo)}`,
    `De <s>R$ ${Number(precoAnterior).toLocaleString('pt-BR')}</s> por <b>R$ ${Number(preco).toLocaleString('pt-BR')}</b>`,
    `<a href="${escapeHtml(url)}">Abrir anúncio</a>`
  ].filter(Boolean).join('\n')

module.exports = {
  sendNotification,
  mensagemNovoAnuncio,
  mensagemQuedaPreco,
  escapeHtml
}
