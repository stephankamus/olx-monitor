const { query } = require('../database/database')
const $logger = require('../components/Logger')

const COLUNAS = `
  id, id_usuario, apelido, url, ativo, intervalo_minutos, proxima_execucao,
  executar_agora, ultima_execucao, ultimo_status, ultimo_erro,
  anuncios_ultima_execucao, criado
`

const map = (row) => row && {
  id: row.id,
  idUsuario: row.id_usuario,
  apelido: row.apelido,
  url: row.url,
  ativo: row.ativo,
  intervaloMinutos: row.intervalo_minutos,
  proximaExecucao: row.proxima_execucao,
  executarAgora: row.executar_agora,
  ultimaExecucao: row.ultima_execucao,
  ultimoStatus: row.ultimo_status,
  ultimoErro: row.ultimo_erro,
  anunciosUltimaExecucao: row.anuncios_ultima_execucao,
  criado: row.criado
}

const contar = async () => {
  const result = await query('SELECT count(*)::int AS total FROM olx_monitor_busca')
  return result.rows[0].total
}

const listar = async () => {
  const result = await query(`SELECT ${COLUNAS} FROM olx_monitor_busca ORDER BY id`)
  return result.rows.map(map)
}

const listarAtivas = async () => {
  const result = await query(`SELECT ${COLUNAS} FROM olx_monitor_busca WHERE ativo ORDER BY id`)
  return result.rows.map(map)
}

const buscarPorId = async (id) => {
  const result = await query(`SELECT ${COLUNAS} FROM olx_monitor_busca WHERE id = $1`, [id])
  return map(result.rows[0])
}

const buscarPorUrl = async (url) => {
  const result = await query(`SELECT ${COLUNAS} FROM olx_monitor_busca WHERE url = $1`, [url])
  return map(result.rows[0])
}

/**
 * Cria a busca. Se a URL já existir, reativa e devolve o registro existente.
 */
const criar = async ({ url, apelido, intervaloMinutos, idUsuario }) => {
  const result = await query(
    `INSERT INTO olx_monitor_busca (url, apelido, intervalo_minutos, id_usuario, proxima_execucao)
     VALUES ($1, $2, COALESCE($3::int, 360), COALESCE($4::int, 1), now())
     ON CONFLICT (url) DO UPDATE
        SET ativo = true,
            apelido = COALESCE(EXCLUDED.apelido, olx_monitor_busca.apelido),
            proxima_execucao = now()
     RETURNING ${COLUNAS}, (xmax = 0) AS inserido`,
    [url, apelido || null, intervaloMinutos || null, idUsuario || null]
  )
  return { ...map(result.rows[0]), inserido: result.rows[0].inserido }
}

const remover = async (id) => {
  const result = await query(
    'DELETE FROM olx_monitor_busca WHERE id = $1 RETURNING id, apelido, url',
    [id]
  )
  return result.rows[0] || null
}

const definirAtivo = async (id, ativo) => {
  const result = await query(
    `UPDATE olx_monitor_busca
        SET ativo = $2,
            proxima_execucao = CASE WHEN $2 THEN now() ELSE proxima_execucao END
      WHERE id = $1
      RETURNING ${COLUNAS}`,
    [id, ativo]
  )
  return map(result.rows[0])
}

const definirIntervalo = async (id, minutos) => {
  const result = await query(
    `UPDATE olx_monitor_busca
        SET intervalo_minutos = $2,
            proxima_execucao = now() + make_interval(mins => $2)
      WHERE id = $1
      RETURNING ${COLUNAS}`,
    [id, minutos]
  )
  return map(result.rows[0])
}

const forcarExecucao = async (id) => {
  const result = await query(
    `UPDATE olx_monitor_busca
        SET executar_agora = true,
            proxima_execucao = now()
      WHERE id = $1
      RETURNING ${COLUNAS}`,
    [id]
  )
  return map(result.rows[0])
}

const pendentes = async (limite = 10) => {
  const result = await query(
    `SELECT ${COLUNAS}
       FROM olx_monitor_busca
      WHERE ativo
        AND (executar_agora OR proxima_execucao <= now())
      ORDER BY executar_agora DESC, proxima_execucao ASC
      LIMIT $1`,
    [limite]
  )
  return result.rows.map(map)
}

const iniciarExecucao = async (id) => {
  await query(
    `UPDATE olx_monitor_busca
        SET executar_agora = false,
            ultima_execucao = now(),
            ultimo_status = 'executando',
            ultimo_erro = null
      WHERE id = $1`,
    [id]
  )
}

/**
 * Depois da rodada: agenda a próxima execução com base no intervalo atual
 * (que pode ter sido alterado pelo bot durante a execução).
 */
const concluirExecucao = async ({ id, sucesso, status, erro, anuncios }) => {
  const result = await query(
    `UPDATE olx_monitor_busca
        SET proxima_execucao = now() + make_interval(mins => intervalo_minutos),
            ultimo_status = $2,
            ultimo_erro = $3,
            anuncios_ultima_execucao = $4
      WHERE id = $1
      RETURNING ${COLUNAS}`,
    [id, status, erro || null, anuncios || 0]
  )
  return map(result.rows[0])
}

/**
 * Seed inicial: só roda quando a tabela está vazia.
 */
const seed = async (urls, idUsuario = 1, intervaloMinutos) => {
  if (!urls || !urls.length) return 0

  if ((await contar()) > 0) {
    $logger.debug('Seed ignorado: já existem buscas cadastradas')
    return 0
  }

  let criadas = 0
  for (const url of urls) {
    try {
      await criar({ url, idUsuario, intervaloMinutos })
      criadas++
    } catch (error) {
      $logger.error({ err: error.message, url }, 'Falha ao criar busca de seed')
    }
  }

  if (criadas) {
    $logger.info(`${criadas} busca(s) criada(s) a partir do seed`)
  }

  return criadas
}

module.exports = {
  contar,
  listar,
  listarAtivas,
  buscarPorId,
  buscarPorUrl,
  criar,
  remover,
  definirAtivo,
  definirIntervalo,
  forcarExecucao,
  pendentes,
  iniciarExecucao,
  concluirExecucao,
  seed
}
