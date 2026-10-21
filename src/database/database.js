const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')
const config = require('../config')
const $logger = require('../components/Logger')

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL não configurada. Veja o .env.example.')
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

pool.on('error', (err) => {
  $logger.error({ err: err.message }, 'Erro inesperado no pool do Postgres')
})

const query = (text, params) => pool.query(text, params)

// Aplica o schema do módulo (idempotente).
const init = async () => {
  const file = path.join(__dirname, '..', 'db', 'init.sql')
  const sql = fs.readFileSync(file, 'utf8')
  await pool.query(sql)
}

// Lock único por processo/dono: garante que duas instâncias nunca executem
// a mesma rodada em paralelo.
const LOCK_KEY = 918273645

const tryLock = async () => {
  const result = await query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY])
  return result.rows[0].locked === true
}

const unlock = async () => {
  try {
    await query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
  } catch (error) {
    $logger.error({ err: error.message }, 'Falha ao liberar advisory lock')
  }
}

// numeric do Postgres chega como string
const toNumber = (value) => (value === null || value === undefined ? null : Number(value))

module.exports = {
  pool,
  query,
  init,
  tryLock,
  unlock,
  toNumber
}
