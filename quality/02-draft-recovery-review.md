# Recuperação de rascunhos — item 2

A direção de UI é a biblioteca de caderno existente: cabeçalhos tipográficos de arquivo, fundo verde de papel, um filete dourado como marca marginal e texto legível. “Recuperar rascunhos” lista data, título e início do texto; a escolha nunca salva na mesa. A janela atual passa para outra identidade local antes de a cópia escolhida abrir.

## Evidências de QA

- Antes da correção, duas abas `window.open` copiavam a identidade `ee171dd4-6418-421c-967b-174a3b4cc80d`; editar B substituía a cópia local de A. A leitura da cópia recuperável retornava o texto B, duas vezes. Conteúdo ficcional, nenhuma chamada de salvamento.
- Depois da correção, A (`da460b48-dc9e-4a99-b8f3-c0b2efd829eb`) e B (`b701551e-71ae-48b3-95ee-4b71a396374e`) receberam IDs distintos. A manteve “Corrigido A: caminho pela ponte.”; B manteve “Corrigido B: caminho pela floresta.” após reload.
- Outra aba abriu a lista, mostrou o texto/datas e recuperou a escolha mantendo uma cópia anterior do rascunho que já estava aberto. Contagem de salvamento à mesa permaneceu 0.
- Quota local real esgotada (`QuotaExceededError`, 159 blocos de 32 KiB). Após digitar texto longo, o botão de leitura da cópia retornou 54.033 caracteres do IndexedDB. Uso do JSON de emergência conferiu formato, título, tamanho 42.036, trecho de início e presença do mapa/quadro.
- Com IndexedDB indisponível por configuração QA e localStorage cheio, o aviso apareceu e “Baixar cópia” criou JSON válido; chamadas à mesa 0. Após liberar quota, armazenamento somente localStorage recarregou o texto.
- Viewport 390 × 844: conteúdo 390 px de largura e sem transbordo horizontal; ações da lista têm altura >= 44 px. Evidência: `02-draft-recovery-mobile.png`. Layout e nota aberta em desktop: `02-draft-recovery-desktop.png`.
- `npm run build` concluiu em 11,32s. Aviso existente: pacote Three.js gera chunk de 549,83 KiB; build passou.

## Limites

A interrupção abrupta do processo/navegador não foi simulada. O timeout (2 s) cobre as requisições de IndexedDB; localStorage é síncrono. O debounce continua 250 ms. Abandono do SO durante o debounce ou limpeza geral do armazenamento não podem ser evitados; a janela avisa quando gravações falham e oferece JSON.

Tudo foi feito em `quality/02-draft-recovery.html` com nota, identidade de sala/conta e textos fictícios; nenhum fixture de produção nem endpoint é usado.
