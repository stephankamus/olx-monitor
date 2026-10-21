<img alt="OLX Monitor" src="assets/olx-monitor-banner.png"></img>

# OLX Monitor

Estava procurando um produto específico no OLX, e diariamente acessava minhas buscas salvas no aplicativo à procura de uma boa oportunidade. Um dia encontrei uma ótima oportunidade, mas quando entrei em contato com o vendedor já era tarde, ele já estava indo ao encontro do comprador e caso a a venda não desse certo tinham mais 3 pessoas na espera para comprar.

Vi nessa situação uma oportunidade para aprender um pouco sobre scrapping usando o `nodejs` para tentar não perder uma próxima oportunidade. Espero que você também consiga o mesmo.

## Instalação e configuração

Para utilizar esse script você precisa ter o `node` e o `npm` devidamente instalados, ter uma conta no [Telegram](https://telegram.org/), e idealmente um computador que fique ligado 27/7 para executar o script continuamente. Eu usei um Raspberry Pi 2 que consome pouca energia e já uso para outros fins, mas você pode usar um VPS, ou um sevidor gratuito da Oracle.

Se você já está familiarizado com a API do Telegram e já mexeu bom bots segue um passo-a-passo mais enxuto:

### Usando Node

1. Clonar ou fazer download do repositório `git clone https://github.com/stephankamus/olx-monitor.git`
1. Acessar a pasta onde os arquivos js se encontram `cd src`
1. Instalar as dependências com o comando `npm install`
1. Copiar `src/.env.example` para `src/.env` e preencher ao menos `DATABASE_URL` (Postgres)
1. Executar o script com `npm start` (ou `npm run dev` com nodemon)
1. Acompanhar o andamento no terminal (log em JSON, via `pino`)
1. O schema `olx_monitor_*` é criado automaticamente na primeira execução. As buscas monitoradas **não** ficam mais no `config.js`: elas vivem no banco e são administradas pelo bot do Telegram (`/olx ...`)

### Usando docker-compose

Se você quiser utiliar o Docker para não ter que instalar o Node e nem as dependências diretamente na sua máquina siga os seguintes passos

1. Copie `src/.env.example` para `src/.env` e preencha `DATABASE_URL`
2. Rode `docker compose up -d --build` (ou use a imagem publicada: `stephankamus/homedev:olx-monitor`)
3. Para adicionar/remover buscas ou mudar o intervalo **não** é necessário rebuildar a imagem: use o bot do Telegram


### Configuração do Telegram

Para você poder receber as notificações pelo Telegram você precisa ter algumas coisas, um bot que terá um token e um grupo que tenho bot com que você irá criar como participante.

#### Criar seu bot

Para conseguir o seu token você precisa criar o seu próprio bot. Eu pretendo fazer um tutorial, mas enquanto isso você pode usar esse [aqui](https://www.youtube.com/watch?v=4u9JQR0-Bgc&feature=youtu.be&t=88). O vídeo é longo mas você só precisa assistir até: 3:24. Com esse vídeo você irá conseguir obter o seu token.

#### Descobrindo seu CHAT ID

Depois de criar o seu bot, crie um grupo e convite o seu bot que você acabou de criar e també um outro bot, o `@idbot`, ele vai te ajudar a descobrir o `CHAT_ID` que precisamos para enviar a notificação. 

Depois de incluir o no grupo, basta digitar `/getgroupid@myidbot` e bot irá responder com o ID do chat. 

#### Editando seu ambiênte

Dentro do repositório existe o `src/.env.example`; copie para `src/.env` e preencha.

| Variável | Exemplo / observação |
| --- | --- |
| `DATABASE_URL` | `postgresql://usuario:senha@host:5432/banco` — **obrigatório** |
| `TELEGRAM_TOKEN` | opcional (fallback). O normal é ler de `chats_telegram.token` |
| `TELEGRAM_CHAT_ID` | opcional (fallback). O normal é ler de `usuarios.chatid_telegram` |
| `DEFAULT_INTERVAL_MINUTES` | 360 (4x por dia) |
| `TICK_SECONDS` | 60 — de quanto em quanto tempo o processo procura busca vencida |
| `MIN_DROP_PERCENT` | 0 — alerta qualquer queda de preço |
| `MAX_PAGES` | 100 — limite de páginas por busca |
| `LOG_LEVEL` | `info`, `debug`, ... |

### O que deve ser monitorado?

Eu não sei o que você está procurando no OLX, mas você precisa dizer para o script. A forma mais fácil de fazer isso é entrar no site do OLX, fazer uma busca, colocar os filtros que você acha necessário e copiar o endereço que o OLX vai criar.

Recomendo utilizar filtros bem específicos para não gerar resultados com muitos itens. Como esse script irá varrer todos os resultados encontrados, pode ser possível que não seja possível passar por todos os resultados dentro do intervalo definido, isso pode fazer com que o Olx perceba uma quantidade alta de chamadas do seu IP e faça algum bloqueio. Isso nunca me aconteceu, mas pode acontecer.

A partir da v2 as buscas ficam no Postgres (tabela `olx_monitor_busca`) e são administradas pelo bot do Telegram. O `config.js` só serve como *seed*: se a tabela estiver vazia, as URLs da variável `config.urls` (ou de `SEED_URLS`) são cadastradas na primeira execução.

#### Exemplos

##### Apenas uma `URL`

```
config.urls = ['https://sp.olx.com.br/sao-paulo-e-regiao/centro/celulares/iphone?cond=1&cond=2&pe=1600&ps=600&q=iphone']
```

##### Várias `URLs`

Para usar várias `URLs` você só precisa separa-las por vírgula.

```
config.urls = [
    'https://sp.olx.com.br/sao-paulo-e-regiao/centro/celulares/iphone?cond=1&cond=2&pe=1600&ps=600&q=iphone',
    'https://sp.olx.com.br/sao-paulo-e-regiao/imoveis/venda?bae=2&bas=1&gsp=1&pe=600000&ps=100000&se=6&ss=2',
]
```

#### Dica

Quando mais específica sua busca for mais eficiente o script será, se você só buscar por iPhone, no Brasil todo, você vai receber muitas notificações por dia, não vai ser muito legal.

## Administrando as buscas pelo Telegram

Os comandos `/olx ...` são atendidos pelo **TelegramServico** (.NET), que escreve direto no Postgres. O scraper só lê o banco a cada tick, então qualquer alteração vale sem restart e sem rebuild da imagem.

| Comando | Efeito |
| --- | --- |
| `/olx` | mostra a ajuda |
| `/olx listar` | lista as buscas (id, apelido, intervalo, último status) |
| `/olx add <url> [apelido] [intervalo_min]` | cria (ou reativa) uma busca |
| `/olx remover <id>` | remove a busca e o histórico dela |
| `/olx pausar <id>` / `/olx ativar <id>` | pausa / reativa mantendo o histórico |
| `/olx intervalo <id> <min>` | muda o intervalo (15 a 10080 minutos) |
| `/olx rodar [id]` | enfileira execução imediata |
| `/olx ultimos <id> [n]` | últimos anúncios encontrados |
| `/olx status [id]` | últimas execuções (código, páginas, faixa de preço, erro) |

> Importante: um token de bot só pode ter **um** processo fazendo polling. Os comandos `/olx` usam o mesmo bot do TelegramServico; o olx-monitor apenas **envia** notificações (sendMessage), o que não conflita.

## Funcionamento

O script percorre as buscas cadastradas no banco (URLs copiadas do OLX, que já contém os filtros de preço mínimo, máximo etc.), encontra os anúncios dentro da página e persiste em Postgres, nas tabelas `olx_monitor_*`, além de notificar por Telegram.

Cada anúncio é identificado por `(busca_id, anuncio_id)`, onde `anuncio_id` é o `listId` do OLX. Os preços ficam registrados em `olx_monitor_anuncio_preco`, o que permite histórico e gráficos depois. A primeira execução de uma busca **não** notifica (só cria o baseline); a partir daí, anúncios novos e quedas de preço geram mensagem — cada alerta é enviado uma única vez por preço.

Uma rodada é registrada em `olx_monitor_execucao` com código de sucesso/falha, páginas lidas e faixa de preço. Se o OLX bloquear (403/Cloudflare), a rodada falha e **nenhum** anúncio é marcado como "saiu".


## Considerações

- Esse script só funciona com a versão brasileira do OLX, nos outros países a interface é diferente e o scrapper não consegue puxar as informações necessárias para funcionar. Porém a adaptação para outros países deve ser consideravalmente fácil de fazer. As alterações deverão ser feitas no arquivo `Scraper.js`
