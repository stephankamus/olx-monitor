-- Schema do módulo OLX Monitor.
-- Aplicado de forma idempotente na subida do container (database.init()).
-- Estas tabelas pertencem a este módulo: não são geradas por migration do EF.

CREATE TABLE IF NOT EXISTS olx_monitor_busca (
    id                       serial PRIMARY KEY,
    id_usuario               integer NOT NULL DEFAULT 1,
    apelido                  text,
    url                      text NOT NULL UNIQUE,
    ativo                    boolean NOT NULL DEFAULT true,
    intervalo_minutos        integer NOT NULL DEFAULT 360,
    proxima_execucao         timestamptz NOT NULL DEFAULT now(),
    executar_agora           boolean NOT NULL DEFAULT false,
    ultima_execucao          timestamptz,
    ultimo_status            text,
    ultimo_erro              text,
    anuncios_ultima_execucao integer,
    criado                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_olx_busca_pendentes
    ON olx_monitor_busca (proxima_execucao)
    WHERE ativo;

CREATE TABLE IF NOT EXISTS olx_monitor_anuncio (
    busca_id         integer NOT NULL REFERENCES olx_monitor_busca (id) ON DELETE CASCADE,
    anuncio_id       bigint NOT NULL,
    titulo           text,
    preco            numeric(12, 2),
    url              text,
    primeiro_visto   timestamptz NOT NULL DEFAULT now(),
    ultimo_visto     timestamptz NOT NULL DEFAULT now(),
    preco_notificado numeric(12, 2),
    ativo            boolean NOT NULL DEFAULT true,
    PRIMARY KEY (busca_id, anuncio_id)
);

CREATE INDEX IF NOT EXISTS idx_olx_anuncio_busca
    ON olx_monitor_anuncio (busca_id, ultimo_visto DESC);

CREATE TABLE IF NOT EXISTS olx_monitor_anuncio_preco (
    id         serial PRIMARY KEY,
    busca_id   integer NOT NULL,
    anuncio_id bigint NOT NULL,
    preco      numeric(12, 2) NOT NULL,
    dt         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_olx_anuncio_preco FOREIGN KEY (busca_id, anuncio_id)
        REFERENCES olx_monitor_anuncio (busca_id, anuncio_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_olx_anuncio_preco
    ON olx_monitor_anuncio_preco (busca_id, anuncio_id, dt DESC);

CREATE TABLE IF NOT EXISTS olx_monitor_execucao (
    id                    serial PRIMARY KEY,
    busca_id              integer NOT NULL REFERENCES olx_monitor_busca (id) ON DELETE CASCADE,
    dt                    timestamptz NOT NULL DEFAULT now(),
    sucesso               boolean NOT NULL,
    anuncios_encontrados  integer NOT NULL DEFAULT 0,
    anuncios_novos        integer NOT NULL DEFAULT 0,
    paginas_lidas         integer NOT NULL DEFAULT 0,
    preco_minimo          numeric(12, 2),
    preco_maximo          numeric(12, 2),
    preco_medio           numeric(12, 2),
    duracao_ms            integer NOT NULL DEFAULT 0,
    erro                  text
);

CREATE INDEX IF NOT EXISTS idx_olx_execucao_busca
    ON olx_monitor_execucao (busca_id, dt DESC);

CREATE TABLE IF NOT EXISTS olx_monitor_config (
    chave text PRIMARY KEY,
    valor text
);
