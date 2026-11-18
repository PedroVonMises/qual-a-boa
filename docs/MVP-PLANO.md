# Plano de MVP: Qual a boa? como hub de festas e baladas do ES para o público feminino

Data: 16/11/2026 · Base: `master` em `6abda60` (PR #10 mesclado; PR #11 ainda aberto) · Autor: Claude, a pedido do Pedro

Este documento junta três coisas: (1) o mapa do código feito com o Graphify, (2) a auditoria do que existe hoje (bugs, performance, qualidade, arquitetura, segurança, iOS) e (3) um plano em fases para transformar o app num MVP viável: o lugar onde uma mulher no Espírito Santo descobre **qual a boa** da noite e decide ir com segurança, e onde as casas pagam para aparecer.

---

## 1. Resumo executivo

**O que já temos é muito mais que um protótipo.** O app tem 30+ telas, backend Supabase com 15 migrations e RLS bem pensado (o `user_id` de avaliações e posts anônimos nunca é legível pelo cliente), Comunidade com auto-ocultação por denúncia, check-in, relatos ao vivo, mapa MapLibre sem chave, pipeline de ingestão com gate jurídico e o Plano Casa (R$ 299/mês, 4 festas, Stripe) já codificado. Typecheck passa, lint tem 0 erros (74 avisos, todos em testes), **992 testes do app e 274 testes SQL passam**.

**O que impede o MVP de ser viável não é código, é conteúdo e confiança:**

1. **O app vai ficar vazio em 21/11/2026.** O seed embutido (`app/src/data/seed.json`) foi gerado em 24/10 com datas relativas, e a produção web usa o seed por padrão. Hoje só restam 6 eventos futuros, o último em 21/11. O feed estático está igual (36 eventos, todos "carried", 6 futuros).
2. **Eventos fictícios em casas reais** (Bolt, A Selva, Gordinho, Pub 426, Fluente, Correria, Casa Caipora). O próprio README chama isso de risco jurídico. Para um público que vai decidir sair de casa com base no app, um evento que não existe é uma quebra de confiança grave.
3. **Nada no produto fala com o público feminino ainda.** As tags de vibe são `acessivel`, `lgbtqia`, `pet-friendly`, `vegano`. Não existe selo de protocolo "Não é Não", índice de segurança, preço/lista para mulheres, "volta pra casa" nem canal de denúncia de assédio dedicado.
4. **Monetização pronta, mas não ligada:** secrets do Stripe e webhook não foram implantados, verificação de casa é um `update` manual com service_role, e a regra das lojas (Apple/Google) para vender o plano fora do IAP não foi confirmada.

**Recomendação:** posicionar o Qual a boa? como **"o guia do rolê seguro no ES"**, aberto a todo mundo mas curado para mulheres, com três diferenciais que nenhum agregador de ingressos tem: (a) selo e índice de segurança vindos de mulheres que foram, (b) informação prática que mulheres procuram antes de sair (lista/entrada feminina, horário de pico real, como voltar), (c) ferramentas de cuidado entre amigas (rolê em grupo, "cheguei em casa"). Lançar em beta fechado em janeiro e abrir antes do Carnaval 2027 (terça, 09/02/2027), aproveitando a alta temporada de verão em Vitória, Vila Velha e Guarapari.

---

## 2. Como o código foi mapeado (Graphify)

Ferramenta: [Graphify](https://pypi.org/project/graphifyy/) `graphifyy 0.9.111` com o extra `[sql]`, modo AST (sem LLM, custo zero de tokens).

```bash
pip install "graphifyy[sql]"
graphify update .          # na raiz do repo; gera graphify-out/
graphify explain "isRemote"  # vizinhança de um nó
graphify path "ExplorarScreen" "search_events"
```

Adicionei um `.graphifyignore` que tira do grafo o worker minificado do MapLibre (`app/public/maplibre-gl-worker.mjs`, 508 KB), o feed gerado, o `seed.json` e os mockups HTML antigos. Sem isso, o worker vira a maior "comunidade" e polui o relatório. O relatório gerado está em [`docs/graph/GRAPH_REPORT.md`](graph/GRAPH_REPORT.md); `graphify-out/` (5 MB de `graph.json` + `graph.html` interativo) fica fora do git.

**Números:** 521 arquivos, ~277 mil palavras · 3.287 nós, 11.539 arestas, 126 comunidades · 97% das arestas extraídas diretamente do AST.

**O que o grafo mostra:**

| Achado | Leitura |
|---|---|
| Nós mais conectados: `Text` (230), `useTheme` (180), `Button` (103), `space` (92), `Icon` (84), `PressableScale` (77) | O design system (`app/src/ui`, 56 arquivos) é de fato a base de tudo. Bom sinal: mudanças visuais são centralizadas. |
| `isRemote()` com 62 arestas, importado em 17 arquivos de produção | A decisão "seed ou Supabase" está espalhada por stores, telas e sync. É o principal ponto de acoplamento arquitetural (ver 4.3). |
| 6 ciclos de import `state/X.ts ↔ data/sync/X.ts` (favorites, follows, checkins, live, reviews, support) | Stores chamam o sync e o sync lê o store. Funciona hoje, mas dificulta testes e pode quebrar a ordem de inicialização no Hermes. |
| Maiores arquivos: `data/casas.ts` (556 linhas), `NovaFestaScreen.tsx` (459), `data/sync/community.ts` (423), `VenueMap.web.tsx` (366), `feedRepo.ts` (355) | `data/casas.ts` mistura o modo demo local com o remoto; candidato a dividir. |
| Ligações docs → código (`INGESTION.md → FeedRepo`, `ARCHITECTURE.md → Repo`) | A documentação de arquitetura está realmente amarrada às interfaces; manter. |

Mapa por camada (contagem de arquivos de produção, sem testes):

```
app/app/        rotas expo-router (finas)                       ~35 rotas
app/src/ui      design system (56)  ─┐
app/src/theme   tokens, fontes (3)   ├─ usado por todas as features
app/src/features/<tela> (≈130 arquivos em 25 features: explorar, mapa, casas, comunidade, evento, ajuda, ...)
app/src/state   stores zustand persistidos (18)  ⇄  app/src/data/sync (12)   ← ciclos
app/src/data    Repo (seed | feed | supabase), auth, casas, address (13)
app/src/domain  tipos e regras puras: filtros, recomendação, casas, comunidade (13)
supabase/       15 migrations, 4 Edge Functions (billing-checkout/portal/webhook, delete-account), testes PGlite
ingest/         CLI de ingestão (manual | link | sympla-api | crawler) → app/public/feed/v1
```

---

## 3. Estado atual em uma página

- **Stack:** Expo SDK 58, React Native 0.88, React 19.3, TypeScript strict, expo-router, TanStack Query, zustand. Supabase (Postgres 17). Mapa MapLibre + OpenFreeMap. Vercel para o web.
- **Fonte de dados:** `EXPO_PUBLIC_DATA_SOURCE=seed|feed|supabase`, padrão `seed`. A produção web (Vercel) não define a variável, então **roda no seed embutido**.
- **Conteúdo:** 8 casas no seed (7 reais com eventos fictícios + Casa Maré de demonstração), 76 eventos (só 6 futuros hoje), 25 artistas. O PR #11 (aberto desde 09/11) adiciona 6 casas e 7 eventos reais do Sympla, com coordenadas aproximadas.
- **Ingestão:** roda todo dia às 09:00 UTC e abre o PR #9 ("0 new, 0 changed"). Nenhuma fonte real alimenta o feed ainda.
- **Plano Casa:** telas, quota de 4 festas por mês, `submit_event`, `review_event`, Stripe Checkout/Portal/Webhook com assinatura HMAC e idempotência. Falta implantar secrets e webhook, e verificar casas sem SQL manual.
- **Qualidade:** typecheck ok · lint 0 erros / 74 avisos (todos `require()` e ordem de import em testes) · Jest 88 suites, 992 testes ok · SQL 274 testes ok · CI em `.github/workflows/app-ci.yml`.
- **Plataformas:** web verificado; Android já compilou; iOS nunca rodou em aparelho.

---

## 4. Diagnóstico: bugs, riscos e dívidas

Severidade: **P0** bloqueia o lançamento · **P1** precisa antes do beta aberto · **P2** melhoria importante · **P3** limpeza.

### 4.1 Bugs e riscos de produto

| ID | Sev. | Problema | Evidência | Correção proposta |
|---|---|---|---|---|
| B1 | P0 | App fica sem eventos futuros a partir de 22/11/2026 | `seed.json` gerado em 2026-10-24; produção sem `EXPO_PUBLIC_DATA_SOURCE` cai em `seed` (`app/src/lib/env.ts`); feed com 6 futuros | Curto prazo: regenerar o seed (`npm run seed`) e publicar. Definitivo: produção em `supabase` (ou `feed` real) e seed só em dev/testes. Alerta quando o feed tiver menos de N eventos nos próximos 7 dias. |
| B2 | P0 | Eventos fictícios em casas reais | README e `docs/VENUES.md`; casas Bolt, A Selva, Gordinho etc. no seed | Antes de qualquer divulgação: remover eventos inventados de casas reais (ou trocar por casas fictícias). Só exibir evento real com fonte (`ticketUrl`/Instagram) e data de verificação. |
| B3 | P1 | PR #11 parado há 7 dias | Corrige a Comunidade, regra do endereço em Dados cadastrais e traz as casas do Sympla | Revisar e mesclar (ou fechar) antes de qualquer trabalho novo, para não divergir. |
| B4 | P1 | Erro de hidratação React #418 em todas as rotas do web de produção | Registrado na captura de telas de 30/10; não reverificado hoje | Provável render dependente de `Date.now()`/locale no export estático. Isolar com `+html.tsx` e mover cálculos de "agora" para `useEffect`/client-only. |
| B5 | P1 | Check-in sem verificação de proximidade | `state/checkins.ts` e `AoVivoScreen.tsx` gravam o check-in só pelo horário; a RLS de `checkins` (0005) só checa a janela de tempo | Exigir que a localização (quando concedida) esteja a até ~300 m da casa, validado também no servidor (RPC). Sem isso, relatos de fila/lotação e avaliações "Foi ao evento" podem ser falsificados de casa, o que contamina o índice de segurança. |
| B6 | P1 | Brigada de denúncias pode esconder qualquer post | `community_reports_autohide` (0010) oculta com 3 denunciantes distintos; `ensureUserId` faz `signInAnonymously` | Contas anônimas não contam para auto-ocultação (ou contam com peso menor); exigir conta com e-mail para denunciar; fila de moderação humana para o que foi ocultado. |
| B7 | P1 | Sem limite de frequência para posts e comentários | Só `event_reports_throttle` existe (0005) | Trigger de throttle em `threads`/`comments` (ex.: 5 posts / 10 min, 30 comentários / hora) e limite por IP na borda. |
| B8 | P1 | Sem bloquear ou silenciar usuária | Nenhuma tabela ou UI de bloqueio | `user_blocks` + filtro nas views `threads_feed`/`comments_feed`. Essencial para o público-alvo. |
| B9 | P2 | Lacunas do Plano Casa | memória do projeto: line-up não enviado por `submit_event`; busca de casa só acha casas com festa futura; verificação manual | Incluir `artist_ids` no `submit_event`; busca em `venues` independente de eventos; painel interno de verificação (ver 5.6). |
| B10 | P2 | Erros de produção invisíveis | `lib/crashReport.ts` só grava o último crash no AsyncStorage | Sentry (`@sentry/react-native`) com scrub de PII; alertas de erro do Edge Function. |
| B11 | P2 | Sem analytics de produto | nenhum SDK | PostHog (ou similar) com consentimento LGPD, eventos mínimos (ver seção 9). |
| B12 | P3 | 74 avisos de lint em testes | `require()` e `import/first` | `--fix` + ajustar os mocks de store para `jest.isolateModules`. |

### 4.2 Segurança e privacidade (o que está bom e o que falta)

Já está bem resolvido, e vale manter como princípio:

- `user_id` de avaliações, relatos ao vivo, threads e comentários não é selecionável pelo cliente (grants por coluna em 0005 e 0010). Anônimo é anônimo de verdade.
- Webhook do Stripe valida `Stripe-Signature` com tolerância de 300 s e é idempotente via `billing_events`.
- Funções `security definer` com `search_path` fixo e `revoke execute` de `anon`.
- Localização só "quando em uso", sem background.

Falta:

- **Bloqueio, silenciar e denúncia com motivo "assédio"** (B6, B7, B8).
- **Sem mensagens diretas no MVP.** DM é o principal vetor de assédio em apps sociais; não construir antes de ter moderação madura.
- **Nenhuma presença pública.** Nunca mostrar "quem vai" ou "quem está lá" com nome. Contagens agregadas só com mínimo de 5 pessoas (k-anonimato).
- **Texto de permissão de localização** (`app.json`) cita "Always" no plugin, embora o app não use. Remover `locationAlwaysAndWhenInUsePermission` evita pergunta da revisão da Apple.
- **Preferências que inferem dados sensíveis** (ex.: filtro LGBTQIA+, perfil de gosto) devem continuar só no aparelho. Orientação sexual é dado sensível na LGPD (art. 5º, II).

### 4.3 Arquitetura e qualidade

1. **Unificar a escolha de fonte de dados.** Hoje 17 arquivos perguntam `isRemote()`. Proposta: um `DataContext` (ou o próprio `Repo` estendido) com implementações `Local` e `Remote` para engajamento, comunidade e casas, do mesmo jeito que `Repo` já faz para o catálogo. Stores passam a receber o adaptador injetado. Isso remove os 6 ciclos `state ↔ sync` de uma vez.
2. **Dividir `data/casas.ts`** em `casas.remote.ts` e `casas.demo.ts`, com a interface em `domain/casas.ts`.
3. **Seed só para dev e testes.** Produção nunca embarca `seed.json` (economiza bundle e elimina o B1). Fallback offline vira o último feed baixado em cache.
4. **TanStack Query como única camada de cache remoto.** Stores zustand ficam para estado local de UI e preferências.
5. **Feature flags** simples (tabela `app_config` no Supabase ou Edge Config) para ligar Plano Casa, Comunidade e recursos de segurança por cidade sem nova build.
6. **Atualizações OTA** com `expo-updates` (EAS Update) para corrigir conteúdo e bugs sem esperar a loja.
7. **Testes E2E** de 5 jornadas críticas no web com Playwright no CI (abrir Início, filtrar, abrir evento, salvar, comprar ingresso → link externo). O script de captura de telas (`app/scripts/capture-screens.mjs`) já faz metade disso.

### 4.4 Performance

| Área | Hoje | Proposta | Meta |
|---|---|---|---|
| Busca (`search_events`, 0002) | Haversine em todas as linhas, `fold_text` por linha, paginação por offset | Pré-filtro por caixa (bbox) com índice em `(lat, lng)` já existente, ou PostGIS `geography` + GiST; índice `pg_trgm` em `fold_text(title)`; paginação por cursor (`starts_at, id`) | p95 < 150 ms com 10 mil eventos |
| Listas | `FlashList` só em Shelf, Feed e Explorar; ~23 telas com `ScrollView` + `.map` | Trocar por `FlashList` onde a lista cresce (Busca, Salvos, Avaliações, Painel da casa) | 60 fps num Android intermediário (ex.: Moto G) |
| Mapa web | `maplibre-gl` lazy, worker de 508 KB versionado em `public/` | Gerar o worker no build (script) e cachear com `Cache-Control: immutable` | Mapa interativo < 2 s em 4G |
| Bundle | `seed.json` embarcado | Tirar o seed da produção; checar com `npx expo export --dump-sourcemap` + source-map-explorer | JS inicial < 2 MB |
| Imagens | `expo-image` (bom) | Cartazes em Supabase Storage com transformação (largura 600/1200) e `cachePolicy="memory-disk"` | LCP do evento < 2,5 s |
| Feed estático | `events.json` na Vercel | `Cache-Control: s-maxage=300, stale-while-revalidate=86400` e ETag | — |
| Inicialização | fontes Geist/Outfit carregadas no boot | Pré-carregar só os pesos usados; splash até fontes + 1ª página da query | TTI < 2,5 s no Android intermediário |

### 4.5 Prontidão para iOS

Estado em 28/10 (memória do projeto): bundle iOS exporta, `expo prebuild --platform ios` funciona, EAS já ligado. Pendências:

1. Adicionar `expo-dev-client` (o perfil `development` do `eas.json` já espera) e `expo-system-ui` (cor de fundo iOS).
2. Primeira build de desenvolvimento no EAS e teste num iPhone real (o mapa MapLibre só aparece em build nativa; no Expo Go cai no "Mapa simplificado"). Exige conta Apple Developer paga para instalar em aparelho.
3. `supportsTablet: true` obriga screenshots e layout de iPad na revisão. Para o MVP, `false`.
4. Remover a permissão "Always" de localização (4.2).
5. Login com e-mail funciona; se houver qualquer login social no futuro, a Apple exige "Entrar com Apple".
6. Conteúdo gerado por usuárias (Comunidade e avaliações) exige, pela diretriz 1.2 da App Store: filtro de conteúdo, denúncia, **bloqueio de usuárias** e contato publicado. Hoje faltam o bloqueio e um canal de contato visível: **é bloqueador de aprovação** (B8).
7. Compra do Plano Casa: manter a compra só no site (Stripe), sem botão de compra nem link de pagamento dentro do app iOS até confirmar as regras 3.1.1/3.1.3 para serviços B2B. Na tela do app, mostrar só o status da assinatura.
8. Classificação etária 17+ (álcool e vida noturna).

---

## 5. Produto: o MVP para o público feminino

### 5.1 Posicionamento

> **Qual a boa?** é o guia da noite capixaba que te diz onde está bom hoje, quanto custa, como é o clima e se é um lugar onde você vai se sentir segura, com base em quem foi.

- **Aberto a todos, curado para mulheres.** Não exigir nem verificar gênero: seria discriminatório, criaria dado pessoal desnecessário e afastaria o grupo de amigos misto que sai junto. O foco está na curadoria, no conteúdo e nos recursos de segurança.
- **Sinal de confiança acima de tudo.** Cada informação mostra a origem ("confirmado pela casa", "do Sympla", "relatado por 12 pessoas hoje") e quando foi verificada.

### 5.2 Personas

| Persona | Contexto | O que ela quer saber antes de sair |
|---|---|---|
| **Ana, 24, Jardim da Penha** | Sai com 2 ou 3 amigas toda semana, decide no grupo do WhatsApp às 21h | Onde está bom hoje, se tem lista ou entrada feminina, como está a fila, se dá para voltar de app sem estresse |
| **Bia, 29, Vila Velha** | Sai menos, quer lugar "certeiro" e seguro, odeia ambiente com assédio | Se a casa segue o protocolo Não é Não, o que outras mulheres disseram sobre segurança, tipo de público |
| **Carol, 33, Serra** | Organiza aniversários e saídas de grupo | Camarote/reserva, preço total por pessoa, estacionamento, dress code |
| **Casa / produtora** | Bar, boate ou produtora em Vitória e Vila Velha | Encher a casa nas noites fracas, atrair público feminino (que puxa o restante), provar que é segura |

### 5.3 Jornadas principais (o MVP precisa fazer bem só estas)

1. **"Qual a boa hoje?"**: abrir o app às 21h, ver o que está acontecendo hoje perto de mim, filtrar por estilo e preço, e ver o clima ao vivo.
2. **"É seguro?"**: abrir a casa ou o evento e ver o selo, o índice de segurança e os relatos de mulheres que foram.
3. **"Bora?"**: mandar o evento para o grupo (já existe "Chamar a galera"), combinar e salvar.
4. **"Cheguei"**: na volta, avisar as amigas que chegou em casa.
5. **"Conta como foi"**: no dia seguinte, avaliar em 20 segundos, com foco em segurança e clima.

### 5.4 Recursos de segurança e cuidado (diferencial)

Contexto legal que favorece o produto: a [Lei federal 14.786/2023](https://legis.senado.leg.br/norma/38058211/publicacao/38060948) criou o protocolo **"Não é Não"**, obrigatório para casas noturnas, boates e espetáculos com venda de bebida alcoólica, e o selo **"Não é Não – Mulheres Seguras"** ([guia do Ministério das Mulheres](https://www.gov.br/mulheres/pt-br/central-de-conteudos/noticias/2024/fevereiro/ministerios-das-mulheres-e-do-turismo-lancam-guia-com-dicas-sobre-o-protocolo-nao-e-nao/MiniguiadigitalsobreProtocoloNaoENaoMulheresSeguras_FINAL.pdf)). No ES também há lei estadual obrigando bares e casas noturnas a apoiar mulheres que se sintam ameaçadas ([Folha Vitória](https://www.folhavitoria.com.br/politica/agora-e-lei-bares-e-casas-noturnas-do-es-terao-que-apoiar-mulheres-que-se-sentirem-ameacadas/)), e casas capixabas já usam códigos de pedido de ajuda ([A Gazeta](https://www.agazeta.com.br/hz/cultura/bares-e-baladas-do-es-usam-codigos-para-ajudar-mulheres-em-risco-0523)). Antes de publicar qualquer texto legal no app, confirmar o número e o texto da lei estadual com um advogado.

| # | Recurso | MVP? | Como funciona | Onde entra no código |
|---|---|---|---|---|
| S1 | **Selo "Protocolo Não é Não"** | Sim | A casa declara no Plano Casa (gratuito também) e envia evidência (foto do cartaz no banheiro, nome de quem responde pelo protocolo). Equipe verifica. Três estados: declarado, verificado, contestado (quando relatos contradizem). **O selo nunca é vendido.** | Nova tag `nao-e-nao` em `domain/accessTags.ts` + CHECK da migration 0009; coluna `safety_protocol_verified_at` em `venues`; selo em `features/casa` e `ui/EventCard` |
| S2 | **Índice de segurança da casa** | Sim | Média das notas do tópico `seguranca` (já existe em `ReviewTopic`) só de avaliações "Foi ao evento" com check-in válido (B5), últimos 6 meses, exibido só com 5 ou mais avaliações. Perguntas curtas: "Você se sentiu segura?", "Sofreu ou viu assédio?", "A equipe ajudou quando precisou?" | `features/avaliar/content.ts`, nova view `venue_safety_stats` (agregada, k ≥ 5) |
| S3 | **Denúncia de assédio** | Sim | Canal privado "Aconteceu algo comigo" no evento ou na casa: registra (anônimo para a casa), oferece 190 e 180 com um toque, e alimenta o status do selo. Nunca é publicado como post. | `TicketTopic 'seguranca'` já existe em `domain/engage.ts`; tela dedicada a partir de Evento/Casa |
| S4 | **Botões de emergência** | Sim | Em Evento, Ao vivo e Casa: "Ligar 190", "Ligar 180 (Central da Mulher)", "Compartilhar minha localização" (usa o compartilhamento do sistema, o app não guarda) | `features/evento`, `features/aoVivo` |
| S5 | **"Cheguei em casa"** | Sim, versão simples | Ao sair do evento, a usuária escolhe 1 a 3 contatos e o app abre WhatsApp/SMS com mensagem pronta ("Tô saindo do X, aviso quando chegar"). Lembrete local depois de N minutos: "Já chegou? Avise suas amigas". Nada vai para o servidor. | Nova feature `features/volta`, notificação local com `expo-notifications` |
| S6 | **Rolê em grupo** | Fase 2 | "Chamar a galera" vira um grupo efêmero do evento (link), com quem confirmou e ponto de encontro. Sem chat aberto no MVP. | `features/evento` (share sheet atual) |
| S7 | **Bloquear e silenciar** | Sim (exigência da Apple) | Bloquear autora de post/comentário; os conteúdos dela somem para você | B8 |
| S8 | **Informações de volta** | Sim | Na casa: ponto de embarque de app, rua iluminada sim/não, ponto de ônibus, estacionamento. Preenchido pela casa e validado por relatos. | Campos novos em `venues` |
| S9 | **Moderação com prioridade para segurança** | Sim | Fila com SLA (relatos de assédio em até 12 h), moderação feita preferencialmente por mulheres, filtro de palavras para posts (pt-BR), ocultação automática revisada por humano | Painel interno (5.6) |

O que **não** fazer no MVP: mapa de "quem está onde", DM entre usuárias, perfil público com foto, ranking de "mulheres mais bonitas"/"noite das solteiras" ou qualquer recurso que transforme as usuárias em atração. O produto é para elas, não sobre elas.

### 5.5 Conteúdo e dados (o maior risco do MVP)

Sem eventos reais e atualizados, nada do resto importa. Plano de oferta:

1. **Começar pequeno e completo:** Vitória (Praia do Canto, Jardim da Penha, Centro, Camburi) e Vila Velha (Praia da Costa, Itapuã). Meta de lançamento: **40 casas** e **80+ eventos/semana** nas sextas e sábados. Guarapari e Serra entram no verão como expansão.
2. **Fontes, em ordem de confiança:** (a) a própria casa via Plano Casa ou formulário grátis; (b) Sympla/Ingresse/Shotgun pela página pública do evento (o adapter `link` já respeita robots.txt e limita requisições); (c) Instagram das casas, com curadoria manual (sem scraping); (d) colaboração da comunidade (sugerir evento, que entra como pendente).
3. **Curadoria humana de 2 a 4 horas por dia** nas primeiras 8 semanas. O pipeline `ingest/` já tem a fila `needsReview` e o `approved.json`; falta uma tela simples para aprovar sem editar JSON.
4. **Campos novos que importam para o público feminino** (em `EventItem`/`events`):
   - `womenEntry`: preço ou gratuidade para mulheres e até que horário ("Mulher free até 0h30"), além do link da lista. É a informação mais procurada em balada no Brasil e quase nenhum agregador estrutura. Atenção: entrada diferenciada por gênero já foi questionada judicialmente em alguns estados; mostrar o que a casa oferece, sem o app promover a diferenciação, e validar com advogado.
   - `dressCode`, `ageMin` real, `ticketTiers` (pista/camarote/mesa), `peakTime` (de relatos ao vivo).
   - `sourceUrl` e `verifiedAt` obrigatórios para evento real.
5. **Política de dados de demonstração:** em produção, zero conteúdo fictício. A Casa Maré fica só em builds de preview.
6. **Frescor:** cada evento sem confirmação há 7 dias ganha um aviso "não confirmado"; casas sem evento há 30 dias saem da Início.

### 5.6 Ferramentas internas (back-office mínimo)

Hoje verificação de casa, aprovação de festa e moderação são `update` com service_role. Para operar com segurança e sem erro:

- Uma área `/admin` no web (rota protegida por papel `staff` no `profiles`, checado por RLS e por Edge Function), com: fila de festas pendentes (`review_event`), verificação de casas e de selo S1, fila de moderação (posts ocultados, denúncias de assédio), aprovação de candidatos da ingestão.
- Log de auditoria (`admin_actions`) com quem fez o quê.

---

## 6. Monetização

### 6.1 O que já existe

Plano Casa a **R$ 299/mês com 4 festas por mês**, cobrado por Stripe Billing + Checkout no web, Customer Portal para cartão e cancelamento. O código está pronto; falta implantar (secrets `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`; deploy de `billing-webhook` com `--no-verify-jwt`).

### 6.2 Proposta de grade (para decidir)

| Plano | Preço sugerido | O que inclui | Para quem |
|---|---|---|---|
| **Grátis** | R$ 0 | Perfil verificado da casa, 1 festa por mês, pedido do selo Não é Não, responder avaliações | Toda casa: alimenta o catálogo, que é o que mais importa no início |
| **Casa** (existente) | R$ 299/mês | 4 festas por mês, cartaz, line-up, estatísticas (visualizações, salvos, cliques em ingresso), destaque na Início do dia da festa | Bares e boates com agenda semanal |
| **Destaque avulso** | R$ 49 a R$ 149 por evento | Topo da Início e do mapa no dia, notificação para quem segue a casa ou o estilo | Produtoras de eventos pontuais, Réveillon, Carnaval |
| **Produtora** | R$ 699/mês (a validar) | Várias casas e eventos, multiusuária | Produtoras que rodam em várias casas |

Regras de integridade (escrever nos Termos): **posição paga é sempre marcada "Patrocinado"**; selo e índice de segurança **nunca** são influenciados por pagamento; casa pagante pode responder avaliações, mas não apagá-las.

### 6.3 Outras receitas (fase 2+)

- **Afiliação de ingressos:** verificar programas de afiliado de Sympla, Ingresse e Shotgun. O app já leva a usuária ao `ticketUrl`; marcar o clique com UTM desde já para medir conversão.
- **Lista VIP como lead:** a casa paga por nome confirmado na lista (CPA), usando o campo `womenEntry`.
- **Patrocínio de marca** (bebidas, transporte por app, cosméticos): só com regras do CONAR para álcool, público 18+ e sem segmentar por gênero de forma invasiva.
- **Parceria de transporte** (código de desconto na volta) casa bem com o S5.

### 6.4 Conta de padaria

Com 30 casas pagantes no plano Casa: 30 × R$ 299 = **R$ 8.970/mês de receita recorrente**, menos as taxas do Stripe (confirmar a tarifa atual para cartão no Brasil e se Pix recorrente está disponível na conta). Custo de infraestrutura no começo é baixo (Supabase Pro, Vercel, EAS, Apple Developer US$ 99/ano, Google Play US$ 25 uma vez). O maior custo é **gente**: curadoria e moderação. Meta de equilíbrio: 15 a 20 casas pagantes cobrindo infraestrutura + 1 pessoa de curadoria em meio período.

### 6.5 Risco das lojas

O ponto em aberto mais importante: se a Apple/Google aceitam que o Plano Casa (serviço B2B de divulgação) seja vendido só fora do app. Mitigação já desenhada: compra somente no web, app sem botão de compra. Confirmar com as diretrizes atuais antes do envio à revisão.

---

## 7. LGPD, termos e jurídico

1. **Termos de Uso e Política de Privacidade** reescritos para produção (sem a menção a dados de demonstração), com encarregada/DPO e e-mail de contato.
2. **Base legal por dado:** localização (consentimento, só em uso), e-mail (execução de contrato), avaliações/posts (legítimo interesse + moderação), analytics (consentimento, com opção de recusar).
3. **Dados sensíveis:** não coletar gênero obrigatório. Se houver pesquisa opcional de perfil, guardar agregada e separada da conta.
4. **Exclusão e exportação** já existem (`delete-account`, "Minha conta"); testar em produção.
5. **Nomes, logos e cartazes das casas:** usar só com autorização ou de fonte pública com atribuição; `imageUrl` só com permissão (regra já documentada).
6. **Notice and takedown** (Marco Civil, art. 19 e 21): canal para pedido de remoção de conteúdo, inclusive de imagem íntima, com prazo curto.
7. **Público 18+:** manter o gate de idade (autodeclarado) e a classificação 17+/18 nas lojas.

---

## 8. Roadmap em fases

Hoje é 16/11/2026. Datas são metas, assumindo 1 pessoa desenvolvendo com apoio do Claude.

### Fase 0: Estabilizar (16/11 a 29/11, 2 semanas)

- [ ] Revisar e mesclar (ou fechar) o PR #11; fechar ou ajustar o PR #9 da ingestão.
- [ ] **B1**: regenerar o seed agora (paliativo) e decidir a fonte de produção (`supabase` recomendado).
- [ ] **B2**: remover eventos fictícios de casas reais em produção.
- [ ] B4 (hidratação), B10 (Sentry), B12 (lint).
- [ ] Ambiente Supabase de produção com migrations 0001–0015 aplicadas e `npm run test:remote` verde.
- [ ] Implantar secrets e webhook do Stripe em modo teste; fazer uma assinatura de ponta a ponta.

### Fase 1: Conteúdo real + segurança v1 (30/11 a 03/01, 5 semanas)

- [ ] Curadoria: 40 casas, eventos reais de dezembro e Réveillon. Tela simples de aprovação da ingestão (feita: `/admin` > Ingestão, migration 0025).
- [ ] Campos `womenEntry`, `sourceUrl`, `verifiedAt`, `dressCode`, informações de volta (S8).
- [ ] S1 selo Não é Não, S2 índice de segurança, S3 denúncia de assédio, S4 emergência, S7 bloquear/silenciar, B5 check-in por proximidade, B6/B7 anti-brigada e throttle.
- [x] Back-office `/admin` mínimo (5.6): migration 0024 (`staff_members`, `admin_actions`, filas e decisões `admin_*`), tela `/admin`.
- [ ] Refatoração 4.3 itens 1 a 3 (acoplamento `isRemote`, ciclos, seed fora da produção).
- [ ] Performance 4.4: busca com bbox + trigram, FlashList nas listas longas.

### Fase 2: Beta fechado (04/01 a 31/01, 4 semanas)

- [ ] Build iOS e Android pelo EAS (TestFlight e teste interno do Play), itens de 4.5.
- [ ] 150 a 300 beta testers recrutadas em Vitória e Vila Velha (grupos de amigas, universitárias da UFES, coletivos), mais 10 casas parceiras no plano Grátis/Casa com desconto de lançamento.
- [ ] S5 "Cheguei em casa" e lembretes locais.
- [ ] Analytics com consentimento; painel de métricas (seção 9).
- [ ] Entrevistas semanais com 5 usuárias e 2 casas; ajustar.

### Fase 3: Lançamento público (01/02 a 09/02/2027, antes do Carnaval)

- [ ] Envio às lojas (com folga para revisão: enviar até 25/01).
- [ ] Plano Casa em produção no Stripe; Destaque avulso para Carnaval.
- [ ] Guia especial de Carnaval 2027 (blocos e festas) como gancho de aquisição.

### Fase 4: Pós-lançamento (fevereiro em diante)

- Expansão para Serra, Cariacica e Guarapari; S6 rolê em grupo; afiliação de ingressos; plano Produtora; notificações push por estilo e casa seguida (alertas já modelados em `domain/engage.ts`).

---

## 9. Métricas do MVP

| Métrica | Definição | Meta no fim do beta |
|---|---|---|
| **North star: rolês planejados/semana** | Usuárias distintas que salvaram, compartilharam ou clicaram em ingresso de um evento da semana | 300 |
| Retenção | Volta na semana seguinte (W1) | ≥ 35% |
| Frescor do catálogo | % de eventos da semana com `verifiedAt` < 7 dias | ≥ 90% |
| Cobertura de segurança | % de casas com selo verificado ou índice com ≥ 5 avaliações | ≥ 50% |
| Avaliações por evento | Avaliações "Foi ao evento" por evento realizado | ≥ 3 |
| Tempo de resposta a denúncia | Mediana até a primeira ação da moderação | < 12 h |
| Casas pagantes | Assinaturas ativas no Plano Casa | 10 no beta, 30 em 3 meses |
| Público feminino | % de respostas "mulher" na pesquisa opcional e anônima | ≥ 60% |
| Estabilidade | Sessões sem crash (Sentry) | ≥ 99,5% |

Eventos mínimos de analytics: `app_open`, `search` (filtros usados), `event_view`, `event_save`, `event_share`, `ticket_click`, `venue_view`, `safety_view`, `review_submit`, `report_submit`, `checkin`.

---

## 10. Backlog priorizado

Esforço: P (até 1 dia), M (2 a 4 dias), G (1 a 2 semanas).

| # | Item | Tipo | Sev. | Esforço | Fase | Arquivos principais |
|---|---|---|---|---|---|---|
| 1 | Regenerar seed e publicar (paliativo do B1) | Bug | P0 | P | 0 | `supabase/seed`, `app/src/data/seed.json` |
| 2 | Produção em Supabase; seed só dev | Arquitetura | P0 | M | 0 | `lib/env.ts`, `data/index.ts`, `vercel-build.sh`, `eas.json` |
| 3 | Remover eventos fictícios de casas reais | Conteúdo/jurídico | P0 | P | 0 | `supabase/seed/seed-data.ts`, `ingest/data` |
| 4 | Mesclar ou fechar PR #11 | Processo | P1 | P | 0 | — |
| 5 | Corrigir hidratação #418 | Bug | P1 | M | 0 | `app/app/+html.tsx`, telas com `Date.now()` em render |
| 6 | Sentry com scrub de PII | Qualidade | P2 | P | 0 | `lib/crashReport.ts`, `app/_layout.tsx` |
| 7 | Stripe em modo teste ponta a ponta | Monetização | P1 | M | 0 | `supabase/functions/billing-*` |
| 8 | Bloquear e silenciar usuárias | Segurança | P0 (loja) | M | 1 | nova migration, `data/sync/community.ts`, `ui/CommentItem.tsx` |
| 9 | Anti-brigada e throttle na Comunidade | Segurança | P1 | P | 1 | nova migration (0016+) |
| 10 | Check-in por proximidade (cliente + RPC) | Segurança/dados | P1 | M | 1 | `state/checkins.ts`, `features/aoVivo`, RLS de `checkins` |
| 11 | Selo Não é Não (S1) | Produto | P1 | M | 1 | `domain/accessTags.ts`, migration, `features/casa`, `features/casas` |
| 12 | Índice de segurança (S2) | Produto | P1 | M | 1 | `features/avaliar/content.ts`, view agregada |
| 13 | Denúncia de assédio + emergência (S3, S4) | Produto | P1 | M | 1 | `features/evento`, `features/ajuda` |
| 14 | Campos `womenEntry`, `sourceUrl`, `verifiedAt`, volta | Dados | P1 | M | 1 | `domain/types.ts`, migration, `ingest/src/normalize.ts`, `NovaFestaScreen.tsx` |
| 15 | Back-office `/admin` | Operação | P1 | G | 1 | nova feature + Edge Function |
| 16 | Tela de aprovação da ingestão | Operação | P2 | M | 1 | `ingest/`, `/admin` |
| 17 | Unificar fonte de dados e quebrar ciclos | Arquitetura | P2 | G | 1 | `state/*`, `data/sync/*`, `data/casas.ts` |
| 18 | Busca com bbox + trigram + cursor | Performance | P2 | M | 1 | nova migration sobre `search_events` |
| 19 | FlashList nas listas longas | Performance | P2 | M | 1 | Busca, Salvos, Avaliações, Painel |
| 20 | `expo-dev-client`, `expo-system-ui`, `supportsTablet:false`, permissão "Always" | iOS | P1 | P | 2 | `package.json`, `app.json` |
| 21 | Build iOS/Android no EAS + TestFlight | iOS | P1 | M | 2 | `eas.json` |
| 22 | "Cheguei em casa" (S5) | Produto | P2 | M | 2 | nova `features/volta` |
| 23 | Analytics com consentimento | Produto | P2 | M | 2 | `lib/`, Privacidade |
| 24 | E2E Playwright das 5 jornadas no CI | Qualidade | P2 | M | 2 | `.github/workflows/app-ci.yml` |
| 25 | EAS Update (OTA) | Operação | P2 | P | 2 | `app.json`, `eas.json` |
| 26 | Termos, Privacidade e DPO para produção | Jurídico | P0 | M | 2 | `features/privacidade`, site |
| 27 | Destaque avulso (Stripe one-off) | Monetização | P2 | M | 3 | `functions/billing-*`, `features/casas` |
| 28 | Lint: zerar avisos de testes | Qualidade | P3 | P | qualquer | `src/state/*.test.ts` |

---

## 11. Decisões em aberto para o Pedro

1. **Fonte de dados da produção:** Supabase direto (recomendado) ou feed estático gerado pela ingestão?
2. **Eventos fictícios em casas reais:** remover já (recomendado) ou trocar por casas fictícias até ter dados reais?
3. **Posicionamento:** "aberto a todos, curado para mulheres" (recomendado) ou app exclusivo para mulheres?
4. **Grade de planos:** manter só o Casa R$ 299 ou adicionar Grátis + Destaque avulso?
5. **Campo "entrada/lista feminina":** exibir como informação da casa (recomendado, com revisão jurídica) ou não exibir?
6. **Data-alvo:** beta fechado em janeiro e lançamento antes do Carnaval (09/02/2027)?
7. **Equipe de curadoria e moderação:** quem faz nas primeiras 8 semanas?

---

## Apêndice A: comandos usados nesta auditoria

```bash
# mapa
pip install "graphifyy[sql]" && graphify update .
# qualidade (em app/)
npm ci && npm run typecheck && npm run lint && npx jest && npm run test:sql
# dados
node -e 'const s=require("./src/data/seed.json"); console.log(s.generatedAt, s.events.filter(e=>Date.parse(e.startsAt)>Date.now()).length)'
```

## Apêndice B: fontes externas

- [Lei 14.786/2023 (Senado)](https://legis.senado.leg.br/norma/38058211/publicacao/38060948) e [página da Procuradoria da Mulher do Senado](https://www12.senado.leg.br/institucional/procuradoria/protocolo-nao-e-nao-de-prevencao-a-violencia-contra-mulheres)
- [Guia do protocolo Não é Não, Ministério das Mulheres e do Turismo](https://www.gov.br/mulheres/pt-br/central-de-conteudos/noticias/2024/fevereiro/ministerios-das-mulheres-e-do-turismo-lancam-guia-com-dicas-sobre-o-protocolo-nao-e-nao/MiniguiadigitalsobreProtocoloNaoENaoMulheresSeguras_FINAL.pdf)
- [Folha Vitória: lei no ES obriga bares e casas noturnas a apoiar mulheres](https://www.folhavitoria.com.br/politica/agora-e-lei-bares-e-casas-noturnas-do-es-terao-que-apoiar-mulheres-que-se-sentirem-ameacadas/)
- [Folha Vitória: placa no banheiro e geolocalizador](https://www.folhavitoria.com.br/geral/lei-nao-e-nao-placa-no-banheiro-e-geolocalizador-para-proteger-mulheres-no-es/)
- [A Gazeta: bares e baladas do ES usam códigos para ajudar mulheres em risco](https://www.agazeta.com.br/hz/cultura/bares-e-baladas-do-es-usam-codigos-para-ajudar-mulheres-em-risco-0523)
