const { query, toNumber } = require('../database/database')

const salvarExecucao = async ({
  buscaId,
  sucesso,
  anunciosEncontrados = 0,
  anunciosNovos = 0,
  paginasLidas = 0,
  precoMinimo = null,
  precoMaximo = null,
  precoMedio = null,
  duracaoMs = 0,
  erro = null
}) => {
  const result = await query(
    `INSERT INTO olx_monitor_execucao
        (busca_id, sucesso, anuncios_encontrados, anuncios_novos, paginas_lidas,
         preco_minimo, preco_maximo, preco_medio, duracao_ms, erro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      buscaId,
      sucesso,
      anunciosEncontrados,
      anunciosNovos,
      paginasLidas,
      precoMinimo,
      precoMaximo,
      precoMedio,
      duracaoMs,
      erro
    ]
  )
  return result.rows[0].id
}

/**
 * Usado para decidir se a busca já foi executada alguma vez:
 * a primeira execução não notifica (evita flood de anúncios antigos).
 */
const houveExecucaoAnterior = async (buscaId) => {
  const result = await query(
    `SELECT 1 FROM olx_monitor_execucao
      WHERE busca_id = $1 AND sucesso
      LIMIT 1`,
    [buscaId]
  )
  return result.rowCount > 0
}

const ultimasExecucoes = async (buscaId, limite = 5) => {
  const result = await query(
    `SELECT id, dt, sucesso, anuncios_encontrados, anuncios_novos, paginas_lidas,
            preco_minimo, preco_maximo, preco_medio, duracao_ms, erro
       FROM olx_monitor_execucao
      WHERE busca_id = $1
      ORDER BY dt DESC
      LIMIT $2`,
    [buscaId, limite]
  )

  return result.rows.map((row) => ({
    id: row.id,
    dt: row.dt,
    sucesso: row.sucesso,
    anunciosEncontrados: row.anuncios_encontrados,
    anunciosNovos: row.anuncios_novos,
    paginasLidas: row.paginas_lidas,
    precoMinimo: toNumber(row.preco_minimo),
    precoMaximo: toNumber(row.preco_maximo),
    precoMedio: toNumber(row.preco_medio),
    duracaoMs: row.duracao_ms,
    erro: row.erro
  }))
}

module.exports = {
  salvarExecucao,
  houveExecucaoAnterior,
  ultimasExecucoes
}
