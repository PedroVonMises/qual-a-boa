# Screens: Qual a boa?

Every implemented screen, in the order a user meets it. Screenshots of the web build at iPhone width (390 pt, @2x), seed data plus Perfil > "Carregar dados de exemplo", clock pinned to Sat 24 Oct 2026 20:30 (Vitória) so the Casa Maré demo event is live. Tall screens are captured whole.

Interactive version with the design system: https://claude.ai/artifact/HyRSm12LNa6nVz7qf8fS6h. Tokens and component specs: `DESIGN.md`. Regenerate the images with `app/scripts/capture-screens.mjs` after UI changes.

## Design system reference

| Component gallery (`/dev/ui`) | Cover art |
|---|---|
| <img src="screens/00-componentes.jpg" width="260"> | <img src="screens/00-capas.jpg" width="260"> |

## 1. Entrada

Primeira abertura. O `SessionGuard` só libera o app depois da idade e da localização.

| # | Screen | Route | What it does |
|---|---|---|---|
| 1 | Splash | `—` | Lâmpada desenha o tubo e o miolo acende; segura até fontes e sessão carregarem. |
| 2 | Verificação de idade | `/onboarding/idade` | Gate 18+ obrigatório com aviso "Beba com moderação". |
| 3 | Localização e estilos | `/onboarding/local` | Raio ilustrado, chips de estilos opcionais, GPS ou bairro. |
| 4 | Escolher o bairro | `/onboarding/local (sheet)` | Sheet com bairros de Vitória e Vila Velha. |

<img src="screens/01-splash.jpg" width="200" alt="Splash"> <img src="screens/02-idade.jpg" width="200" alt="Verificação de idade"> <img src="screens/03-local.jpg" width="200" alt="Localização e estilos"> <img src="screens/04-bairro.jpg" width="200" alt="Escolher o bairro">

## 2. Descobrir

Aba Explorar e tudo que abre a partir dela.

| # | Screen | Route | What it does |
|---|---|---|---|
| 5 | Explorar | `/` | Local + data, busca, chips de gênero, prateleiras Para você, Hoje à noite, Fim de semana, Até R$ 40, Perto de você. |
| 6 | Quando | `/ (sheet)` | Atalhos (Hoje, Amanhã, Fim de semana…) e calendário. |
| 7 | Onde você quer sair? | `/ (sheet)` | Perto de mim ou bairro. |
| 8 | Filtros | `/filtros` | Gênero, vibe e acesso, região, preço, distância, data, artista; rodapé "Limpar" + "Ver N eventos". |
| 9 | Busca | `/busca` | Resultados agrupados Casas / Eventos / Artistas com contagem. |
| 10 | Mapa | `/(tabs)/mapa` | Pins das casas e lista "Nesta área" (aqui no modo simplificado, sem tiles). |

<img src="screens/05-explorar.jpg" width="200" alt="Explorar"> <img src="screens/06-quando.jpg" width="200" alt="Quando"> <img src="screens/07-area.jpg" width="200" alt="Onde você quer sair?"> <img src="screens/08-filtros.jpg" width="200" alt="Filtros"> <img src="screens/09-busca.jpg" width="200" alt="Busca"> <img src="screens/15-mapa.jpg" width="200" alt="Mapa">

## 3. Evento

Do card para o detalhe, ingresso, casa e artista.

| # | Screen | Route | What it does |
|---|---|---|---|
| 11 | Evento | `/evento/[id]` | Capa, data, preço, line-up, casa, avaliações; CTA "Ver ingressos". |
| 12 | Chamar a galera | `/evento/[id] (sheet)` | Convite editável: WhatsApp, copiar, mais opções. |
| 13 | Ingressos | `/ingressos/[id]` | Preço, quantidade, meia-entrada e onde a compra termina. |
| 14 | Casa | `/casa/[slug]` | Endereço, horários, tags de acesso, próximos eventos, quem já tocou. |
| 15 | Artista | `/artista/[slug]` | Próximo show, onde já tocou, gêneros. |

<img src="screens/10-evento.jpg" width="200" alt="Evento"> <img src="screens/11-share.jpg" width="200" alt="Chamar a galera"> <img src="screens/12-ingressos.jpg" width="200" alt="Ingressos"> <img src="screens/13-casa.jpg" width="200" alt="Casa"> <img src="screens/14-artista.jpg" width="200" alt="Artista">

## 4. Salvar e acompanhar

Aba Salvos e o ciclo do evento.

| # | Screen | Route | What it does |
|---|---|---|---|
| 16 | Salvos (vazio) | `/(tabs)/salvos` | Lâmpada apagada + "Explorar eventos". |
| 17 | Salvos | `/(tabs)/salvos` | Eventos / Casas / Artistas, agrupado por semana. |
| 18 | Acompanhando | `/acompanhar` | Contagem regressiva, linha do tempo, mudanças. |
| 19 | Avisos | `/acompanhar/avisos` | Toggles por tipo de mudança e canais. |
| 20 | Ao vivo | `/ao-vivo/[id]` | Fila, lotação, música, preço por relatos; checklist antes de sair. |

<img src="screens/16-salvos-vazio.jpg" width="200" alt="Salvos (vazio)"> <img src="screens/18-salvos.jpg" width="200" alt="Salvos"> <img src="screens/19-acompanhar.jpg" width="200" alt="Acompanhando"> <img src="screens/20-avisos.jpg" width="200" alt="Avisos"> <img src="screens/21-aovivo.jpg" width="200" alt="Ao vivo">

## 5. Avaliar

Depois do evento.

| # | Screen | Route | What it does |
|---|---|---|---|
| 21 | Avaliar 1/2 | `/avaliar/[id]` | Estrelas, nota por tópico e tags. |
| 22 | Avaliar 2/2 | `/avaliar/[id]/texto` | Texto, foto e opção anônima. |
| 23 | Avaliações | `/avaliacoes/[id]` | Distribuição, tópicos, selo "Foi ao evento", útil/denunciar. |

<img src="screens/22-avaliar.jpg" width="200" alt="Avaliar 1/2"> <img src="screens/23-avaliar-texto.jpg" width="200" alt="Avaliar 2/2"> <img src="screens/24-avaliacoes.jpg" width="200" alt="Avaliações">

## 6. Perfil e conta

Aba Perfil e telas de conta.

| # | Screen | Route | What it does |
|---|---|---|---|
| 24 | Perfil | `/(tabs)/perfil` | Estilos, raio, avisos, localização, recomendações, dados de exemplo, legal. |
| 25 | Entrar | `/entrar` | Login por código no e-mail. |
| 26 | Minha conta | `/conta` | Visitante vê "Conta indisponível". |
| 27 | Meus eventos | `/meus-eventos` | Avaliações, check-ins, acompanhando. |
| 28 | Privacidade e dados | `/privacidade` | Permissões, dados no aparelho, LGPD. |

<img src="screens/17-perfil.jpg" width="200" alt="Perfil"> <img src="screens/25-entrar.jpg" width="200" alt="Entrar"> <img src="screens/26-conta.jpg" width="200" alt="Minha conta"> <img src="screens/27-meus-eventos.jpg" width="200" alt="Meus eventos"> <img src="screens/28-privacidade.jpg" width="200" alt="Privacidade e dados">

## 7. Ajuda e suporte

Do FAQ ao chamado.

| # | Screen | Route | What it does |
|---|---|---|---|
| 29 | Ajuda | `/ajuda` | Busca, assuntos comuns, chamados em andamento. |
| 30 | Mensagens | `/ajuda/mensagens` | Chamados com status em texto. |
| 31 | Conversa com o suporte | `/ajuda/suporte/[id]` | Card do evento, respostas rápidas, leitura, anexo. |
| 32 | Novo chamado | `/ajuda/novo` | Assunto, evento relacionado, descrição validada, print. |

<img src="screens/29-ajuda.jpg" width="200" alt="Ajuda"> <img src="screens/30-mensagens.jpg" width="200" alt="Mensagens"> <img src="screens/31-conversa.jpg" width="200" alt="Conversa com o suporte"> <img src="screens/32-novo-chamado.jpg" width="200" alt="Novo chamado">

## 8. Sistema

| # | Screen | Route | What it does |
|---|---|---|---|
| 33 | Não encontrada | `/+not-found` | "Essa tela não existe." |

<img src="screens/33-404.jpg" width="200" alt="Não encontrada">

## Desktop (>= 1024)

The tab bar becomes a 240px left rail; Explorar opens with an asymmetric lead grid; Mapa is a list/map split.

<img src="screens/34-desktop-explorar.jpg" width="640" alt="Explorar desktop"> <img src="screens/35-desktop-mapa.jpg" width="640" alt="Mapa desktop">
