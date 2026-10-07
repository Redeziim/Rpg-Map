# ADR 033 — Cópias locais de rascunhos separadas por documento

Data: 2026-10-04. Estado: adotada.

## Contexto

O navegador duplica `sessionStorage` ao abrir uma aba por `window.open`. As duas páginas recebiam o mesmo identificador e gravavam no mesmo registro local. Uma edição na aba duplicada substituía a cópia recuperável da original, mesmo que o texto continuasse visível na original.

## Decisão

- Cada documento gera um novo identificador de escrita em memória. O identificador da página anterior fica somente como origem legada de leitura; recarregar pode retomar a cópia anterior sem voltar a gravar nela.
- localStorage recebe uma chave por caderno e documento. IndexedDB mantém o mesmo escopo e a mesma chave de versão; as leituras tentam o documento atual e a origem da sessão. Chaves legadas do caderno ainda são lidas quando seu proprietário é a aba atual ou sua origem.
- O caderno oferece uma lista explícita das outras cópias da mesma conta, mesa e seção. Antes de abrir outra, qualquer rascunho aberto é guardado em outra cópia. A recuperação inicia uma revisão local e não publica na mesa.
- IndexedDB limitado por tempo informa falha para que a interface avise e ofereça o JSON de emergência existente. Nenhuma cópia antiga é apagada automaticamente.
- Cenas reutilizam o mesmo identificador e os mesmos adaptadores de armazenamento, sem alterar a identidade da cena nem sua publicação explícita.

## Consequências e limites

O isolamento protege documentos clonados e cópias antigas ficam disponíveis até que o próprio navegador remova seus dados. Navegadores podem limpar todo o armazenamento. A gravação tem debounce de 250 ms e os eventos de saída fazem uma tentativa síncrona em localStorage e assíncrona no IndexedDB; nenhuma tentativa consegue preservar dados se ambos os armazenamentos falharem. Por isso o aviso mantém o rascunho aberto e permite baixar seu JSON.

Não há serviço, API, pacote ou servidor de armazenamento novo. O escopo existente continua separado por conta, mesa e caderno. O salvamento na mesa continua uma ação explícita.

## Verificação

Reprodutor local `quality/02-draft-recovery.html` usa notas fictícias e nunca envia conteúdo à API. Duas abas duplicadas editaram textos diferentes; a original conservou seu texto e a cópia recarregada retomou o texto da duplicata. Outra aba abriu uma cópia pela lista, preservou o rascunho que já estava aberto e manteve zero chamadas de salvamento da mesa. Encher o localStorage até `QuotaExceededError` preservou um texto longo no IndexedDB. Com localStorage cheio e IndexedDB indisponível, a interface exibiu o aviso; o JSON de emergência foi lido na fronteira do download e conferido quanto ao formato, título, 42.036 caracteres, início e quadro. Liberar a quota de teste restaurou recarga apenas com localStorage. Em 390 px não houve overflow. Build: `npm run build`; suíte: 134 aprovados, 0 falhas. Nenhum teste de queda abrupta do processo/navegador foi simulado.
