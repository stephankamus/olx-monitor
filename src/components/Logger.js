const pino = require('pino')
const config = require('../config')

// Substitui o simple-node-logger (sem manutenção desde 2019), que usava
// util.isArray/util.isDate — APIs removidas no Node 24.
const options = {
  level: config.logLevel,
  base: { app: 'olx-monitor' },
  timestamp: pino.stdTimeFunctions.isoTime
}

let destination
if (config.logFile) {
  destination = pino.destination({ dest: config.logFile, mkdir: true, sync: false })
}

const logger = destination ? pino(options, destination) : pino(options)

module.exports = logger
