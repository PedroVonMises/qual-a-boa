# Vitória nightlife research (for seed data and design placeholders)

Researched 2026-10-22 via web search. Venue names, neighborhoods and genre tendencies come from public listings; **events, artists, prices and distances in the design mockups are illustrative placeholders**. Everything here must be verified with each venue (Instagram, Sympla, Zig) before real seed data goes live.

| Venue | Area | Genres seen in sources | Confidence | Notes |
|---|---|---|---|---|
| Bolt | Jardim da Penha (R. Darcy Grijó, 20) | indie, pop, rock, funk, hip hop, retro; "Lovy Bolt" nights with love songs, pop, remixes | High | Fri/Sat ~23h-06h; run by O Groove Bar Ltda since 2013 |
| Fluente | Jardim da Penha (Av. Saturnino Rangel Mauro) | funk with DJs; "Match" night: pop BR, funk, sofrência | Medium | Only seen in agenda listings (Folha Vitória, 22h-4h) |
| A Selva | Centro (R. Sete de Setembro, 493) | electronic, house/disco (Discotopia), funk, hip hop/R&B, tecnobrega, forró, indie rock, samba | High | Multi-room; tickets ~R$ 15-60; 18+; Zig tickets |
| Pub 426 | Praia do Canto (R. João da Cruz, 370) | pop/rock bands, 80s/90s, new wave; karaoke on Wednesdays (free) | Medium | Weekly lineup date unclear |
| Correria Music Bar | Praia de Itaparica, **Vila Velha** (Av. Est. José Júlio de Souza, 740) | goth/80s, punk, hardcore, metal | Medium | Not in Vitória; city filter must include metro area |
| Casa Caipora | Centro (R. Nestor Gomes) | independent scene: MPB, samba, rap, rock, DJs | High | **Announced closing; last event 2 Oct 2026.** Treat as closed; keep artist history |
| Sinner Club | Vitória (address unconfirmed) | DJs, live music, metal fests; "balada liberal" (swing club) | High | Adult-themed venue: needs 18+ gate and an editorial decision on listing |
| Gordinho Praia do Canto | Praia do Canto (R. Joaquim Lírio, 823) | pagode, samba | Medium | From a singles' guide |
| Clube A | Praia do Canto | pagode, sertanejo, block-party DJs | Low-Medium | |
| Embrazado, Wanted, Pink Elephant | Triângulo das Bermudas / Centro | eclectic (electronic, hip hop, sertanejo, pagode, MPB, funk); Wanted = sertanejo pub | Low-Medium | |
| Lamah Lounge | Jardim da Penha | pop, funk | Low-Medium | |
| Bali Lounge, Victoria Pub, Villa Bohemia | Camburi | pop/funk/electronic; funk | Low-Medium | |
| Boate Garden | Vila Velha | pagode, funk | Low | |

## Product implications
- Genre taxonomy for MVP: Funk, Pagode/Samba, Sertanejo, Eletrônica/House, Pop/Hits, Rock/Indie, Metal/Punk/Goth, Forró/Tecnobrega, Hip-hop/R&B, Música ao vivo/Karaokê.
- Greater Vitória: search radius must cross into Vila Velha and Serra; label areas (Praia do Canto, Jardim da Penha, Centro, Camburi, Itaparica).
- Venue status field is needed (`open` / `closed` / `unverified`): Casa Caipora proves venues close; show history without upcoming events.
- Adult-themed venues (Sinner) need an explicit policy before listing.
- Using real venue names: obtain venue consent or keep to factual listings; never show invented line-ups for real venues in production.

## Sources
- Folha Vitória weekend agendas (Fluente, Bolt): https://www.folhavitoria.com.br/cultura/agenda-cultural/fim-de-semana-no-es-tem-silva-festival-de-jazz-teatro-infantil-e-exposicoes/
- Bolt listings: https://circuitobr.com.br/es/vitoria/casas-de-shows/bolt-vitoria , http://www.grupoantimofo.com.br/bolt-antimofo-balada-drink-pop-rock-hip-hop/
- A Selva: https://www.agazeta.com.br/hz/cultura/a-selva-nova-casa-de-eventos-em-vitoria-abre-com-show-de-andre-prando-0523 , https://vixfeed.com/a-selva-tem-programacao-de-carnaval-com-djs-samba-e-muito-mais-em-vitoria/
- Casa Caipora closing: https://www.agazeta.com.br/hz/cultura/casa-caipora-anuncia-fim-das-atividades-apos-quase-tres-anos-movimentando-a-cena-cultural-de-vitoria-0726
- Sinner Club: https://sinnerclub.com.br/
- Pub 426 / Correria: https://www.agazeta.com.br/hz/cultura/afim-de-soltar-a-voz-saiba-onde-encontrar-karaokes-na-grande-vitoria-0522 , https://www.agazeta.com.br/hz/cultura/carnaval-tambem-e-do-rock-no-es-veja-programacao-dos-espacos-0223
- Clube A, Gordinho, Embrazado, Wanted and others: https://esbrasil.com.br/dia-do-solteiro-7-clubes-para-curtir-em-vitoria/ , https://www.folhavitoria.com.br/cultura/funk-rock-e-sertanejo-para-curtir-a-balada-na-grande-vitoria-no-fim-de-semana/
