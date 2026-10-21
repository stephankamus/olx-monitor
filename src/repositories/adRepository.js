const { query, toNumber } = require('../database/database')

const COLUNAS = `
  busca_id, anuncio_id, titulo, preco, url, primeiro_visto, ultimo_visto,
  preco_notificado, ativo
`

const map = (row) => row && {
  buscaId: row.busca_id,
  anuncioId: Number(row.anuncio_id),
  titulo: row.titulo,
  preco: toNumber(row.preco),
  url: row.url,
  primeiroVisto: row.primeiro_visto,
  ultimoVisto: row.ultimo_visto,
  precoNotificado: toNumber(row.preco_notificado),
  ativo: row.ativo
}

const buscar = async (buscaId, anuncioId) => {
  const result = await query(
    `SELECT ${COLUNAS} FROM olx_monitor_anuncio WHERE busca_id = $1 AND anuncio_id = $2`,
    [buscaId, anuncioId]
  )
  return map(result.rows[0])
}

const criar = async ({ buscaId, anuncioId, titulo, preco, url }) => {
  const result = await query(
    `INSERT INTO olx_monitor_anuncio (busca_id, anuncio_id, titulo, preco, url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (busca_id, anuncio_id) DO UPDATE
        SET titulo = EXCLUDED.titulo,
            preco = EXCLUDED.preco,
            url = EXCLUDED.url,
            ultimo_visto = now(),
            ativo = true
     RETURNING ${COLUNAS}`,
    [buscaId, anuncioId, titulo, preco, url]
  )
  return map(result.rows[0])
}

const atualizarPreco = async ({ buscaId, anuncioId, titulo, preco, url }) => {
  const result = await query(
    `UPDATE olx_monitor_anuncio
        SET preco = $3,
            titulo = $4,
            url = $5,
            ultimo_visto = now(),
            ativo = true
      WHERE busca_id = $1 AND anuncio_id = $2
      RETURNING ${COLUNAS}`,
    [buscaId, anuncioId, preco, titulo, url]
  )
  return map(result.rows[0])
}

const registrarVisto = async (buscaId, anuncioId) => {
  await query(
    `UPDATE olx_monitor_anuncio
        SET ultimo_visto = now(), ativo = true
      WHERE busca_id = $1 AND anuncio_id = $2`,
    [buscaId, anuncioId]
  )
}

const salvarHistoricoPreco = async ({ buscaId, anuncioId, preco }) => {
  await query(
    `INSERT INTO olx_monitor_anuncio_preco (busca_id, anuncio_id, preco)
     VALUES ($1, $2, $3)`,
    [buscaId, anuncioId, preco]
  )
}

const marcarNotificado = async (buscaId, anuncioId, preco) => {
  await query(
    `UPDATE olx_monitor_anuncio
        SET preco_notificado = $3
      WHERE busca_id = $1 AND anuncio_id = $2`,
    [buscaId, anuncioId, preco]
  )
}

/**
 * Só deve ser chamado quando a rodada leu TODAS as páginas sem erro.
 */
const marcarAusentes = async (buscaId, idsPresentes) => {
  const ids = (idsPresentes || []).map((id) => Number(id))
  const result = await query(
    `UPDATE olx_monitor_anuncio
        SET ativo = false
      WHERE busca_id = $1
        AND ativo
        AND NOT (anuncio_id = ANY($2::bigint[]))`,
    [buscaId, ids]
  )
  return result.rowCount
}

const ultimos = async (buscaId, limite = 10) => {
  const result = await query(
    `SELECT ${COLUNAS}
       FROM olx_monitor_anuncio
      WHERE busca_id = $1
      ORDER BY primeiro_visto DESC
      LIMIT $2`,
    [buscaId, limite]
  )
  return result.rows.map(map)
}

module.exports = {
  buscar,
  criar,
  atualizarPreco,
  registrarVisto,
  salvarHistoricoPreco,
  marcarNotificado,
  marcarAusentes,
  ultimos
}
