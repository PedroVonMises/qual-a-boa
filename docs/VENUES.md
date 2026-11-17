# Vitória nightlife research (for seed data and design placeholders)

Researched 2026-10-22 via web search. Venue names, neighborhoods and genre tendencies come from public listings; **events, artists, prices and distances are demonstration data (shown without UI tags; the Terms disclose this during the pilot)**. Everything here must be verified with each venue (Instagram, Sympla, Zig) before real seed data goes live.

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

## Sympla, novembro de 2026 (pesquisado em 2026-11-09)

Casas com festas ou shows no Espírito Santo anunciados no Sympla para novembro de 2026. Nome, endereço, data e link vêm da página do evento no Sympla. As coordenadas são aproximadas (nível de rua, sem geocodificação) e nada foi confirmado com a casa, por isso todas entram como `unverified`. No seed, esses eventos têm data fixa e link real; preço e line-up ficam vazios.

| Casa | Endereço | Evento (Sympla) | Data |
|---|---|---|---|
| Taikô Beach Club | R. Joaquim Lírio, 820 - Praia do Canto, Vitória | [Forró do Canto](https://www.sympla.com.br/evento/forro-do-canto/3639480) | 6 nov, 20h |
| Recreio dos Olhos | Av. Cel. José Martins de Figueiredo, 575 - Tabuazeiro, Vitória | [Forrozada Boa](https://www.sympla.com.br/evento/forrozada-boa-pipoca-show-seu-branco-discoteca-forro-veneno/3614801) | 13 nov, 22h |
| Brizz | R. Judite Maria Tovar Varejão, 411 - Enseada do Suá, Vitória | [Flashback Sunset](https://www.sympla.com.br/evento/flashback-sunset/3569075) | 15 nov, 17h |
| Correria Music Bar (já existia) | Av. Est. José Júlio de Souza, 740 - Praia de Itaparica, Vila Velha | [Slipmami em Vila Velha](https://www.sympla.com.br/evento/slipmami-em-vila-velha-es/3565753) | 20 nov, 21h |
| La Isla | R. Thereza Zanoni Caser, 221 - Pontal de Camburi, Vitória | [Sunset by DJ Ale Alves](https://www.sympla.com.br/evento/sunset-by-dj-ale-alves-convidados/3625056) | 21 nov, 16h |
| Cineteatro das Artes | Av. Jerônimo Monteiro, 902, 2º piso - Centro, Vila Velha | [Alex Emissário](https://www.sympla.com.br/evento/alex-emissario-apresenta-em-tempos-de-guerras-a-rima-prevalece/3609093) | 21 nov, 20h |
| The Point | R. Felicidade Siqueira, 80 - Industrial, Vila Velha | [Subsolo](https://www.sympla.com.br/evento/subsolo-the-point/3606059) | 21 nov, 22h (16+) |

Fora da lista: Lagun Vitória (R. Manoel Gonçalves Carneiro, 65) teve festa de 31 out a 1 nov, mas o bairro não aparece na página. Espaço Patrick Ribeiro, Clube ARCI e Na Vista têm shows em novembro em agregadores, mas a venda no Sympla não foi confirmada.

Antes de produção: geocodificar os endereços (`npm run ingest -- --geocode`) e confirmar com cada casa.

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
