# Progresso e cancelamento da importação 3D

Item 46, validado localmente em 2026-10-03. A importação usa o transporte binário do [item 42](MODEL_TRANSFER.md), a conferência de conteúdo do [item 43](MODEL_VALIDATION.md) e a persistência SQLite existente. Não acrescenta serviço externo ou biblioteca.

## O que a interface informa

- **Preparando o pacote:** organiza metadados e referências File/Blob; não inventa um percentual de leitura.
- **Enviando arquivos:** `XMLHttpRequest.upload` informa bytes enviados e total, quando `lengthComputable` é verdadeiro. O percentual mede o transporte, não a publicação na mesa.
- **Conferindo e salvando:** começa quando o navegador terminou o envio. A validação e a transação do servidor não possuem percentual; o indicador permanece indeterminado, sem animação ornamental.
- **Cancelando e conferindo:** interrompe o envio e consulta o resultado definitivo no servidor.
- **Verificar resultado:** aparece se essa consulta falhar. Trocar arquivos e iniciar outro envio ficam bloqueados até esclarecer a operação.

Cancelar mantém a seleção de arquivos para tentar de novo. Confirmar limpa a seleção e seleciona o objeto pelo identificador recebido, em vez de presumir que é o último da lista. Erros recebem foco na região da importação; controles têm nomes acessíveis e o botão de cancelamento mede pelo menos 44 px. A barra expõe `aria-valuenow` apenas com uma medição real. Não foram acrescentadas animações.

## Confirmação privada no servidor

| Endpoint autenticado | Resultado |
| --- | --- |
| `POST /api/rooms/:roomId/map-imports?mapViewMode=master` | Prepara uma operação com identificador aleatório do servidor. Exige permissão de importação. |
| `POST /api/rooms/:roomId/map-assets?mapViewMode=master&importId=:id` | Recebe o pacote uma vez. Valida, publica e confirma o identificador na mesma transação. |
| `GET /api/rooms/:roomId/map-imports/:id` | Consulta uma confirmação pertencente à conta e à mesa atuais. |
| `DELETE /api/rooms/:roomId/map-imports/:id` | Cancela se ainda pendente; devolve o resultado existente se já terminou. |

Estados persistidos: `prepared`, `uploading`, `checking`, `confirmed`, `cancelled` e `failed`. A [migração 004](MIGRATIONS.md) cria `map_imports` e o índice de vencimento. O registro contém dono, mesa, datas, estado e resultado curto; não duplica arquivos. Origem, sessão, limites de requisição e participação atual continuam validados. Outra conta, mesmo mestre/ADM, não consulta ou cancela a operação do autor. Um autor ainda participante pode cancelar sua operação depois de perder a permissão de edição; não pode publicar um modelo novo. A permissão de publicação é conferida novamente após a validação.

O prazo para uma operação pendente é de três minutos. Registros de confirmação vencem em sete dias, com remoção em lotes pela [manutenção](MAINTENANCE.md). Um identificador expirado/desconhecido não inicia um upload novo. Clientes antigos podem continuar enviando sem `importId`, preservando o contrato anterior; a proteção de repetição depende do protocolo novo.

## Cancelamento, repetição e falhas

Cancelar grava o estado antes de interromper a leitura/validação ativa. O worker recebe o sinal de cancelamento e a transação verifica novamente a operação. Uma importação interrompida não publica parte do pacote. Encerrar normalmente o servidor cancela operações ativas; após um encerramento abrupto, a consulta/reconciliação cancela o que ficou pendente.

**Abortar a conexão não desfaz um COMMIT.** Se o objeto já foi adicionado, a interface informa “O modelo já havia sido adicionado antes do cancelamento.” e atualiza a visão da mesa. Reenviar o mesmo identificador confirmado devolve o estado autorizado atual sem criar outro objeto. Remover ou mover o objeto posteriormente não faz uma repetição ressuscitá-lo nem restaurar sua posição antiga.

O navegador conserva somente `{version: 1, id}` no localStorage, separado por conta e mesa. Não guarda os arquivos nessa confirmação. Reabrir a mesma mesa confere e cancela o que ainda estiver pendente; não reenvia automaticamente. Se o armazenamento local falhar, a interface explica que a confirmação vale apenas naquela janela. Fechar/limpar o navegador, usar outro aparelho ou navegar sem esse armazenamento pode perder o identificador local; o arquivo e a lista da mesa devem ser conferidos antes de repetir. Após expiração do registro, “Já conferi a lista” permite uma liberação explícita; uma simples falha de rede não oferece esse atalho.

Prazos locais: dois minutos para preparar/enviar, vinte segundos para a consulta de cancelamento. O progresso de upload pode atingir 100% antes de o servidor terminar. Não existe estimativa de tempo restante, de conversão ou de FPS. O trabalho de carregar/renderizar a cena continua com seus próprios indicadores e recuperação WebGL. A prévia de escala, orientação e posição é o próximo item, 47.

## Evidências de validação

Exatamente três testes novos em `tests/map-import.test.js`, usando HTTP autenticado e SQLite descartável:

1. Confirmação privada, avisos, uma publicação/revisão e bloqueio de jogador, modo jogador e outro autor.
2. Cancelamento antes do envio, durante corpo parcial e durante validação; nenhuma publicação parcial ou cancelamento de terceiro.
3. Resposta perdida depois da gravação, reinício, backup/restauração, manifesto do banco 3 sem tabela nova, recusa de confirmação com JSON corrompido, repetição sem duplicação, posição atual preservada, objeto removido não ressuscitado e acesso revogado.

Suíte completa: 116 testes passaram; build passou com o aviso conhecido sobre o tamanho do bundle Three.js.

`npm run dev` foi validado em 1440 e 390 px, com banco descartável. Um pacote de 18 MiB exibiu medições reais de 58–60% no desktop e 65% no celular. Cancelar durante o envio manteve os arquivos e não acrescentou objeto. Em outro envio, o objeto apareceu por SSE antes da resposta HTTP: cancelar informou a confirmação existente e manteve exatamente dois objetos. Uma falha temporária da resposta de cancelamento exibiu “Verificar resultado”; após recarregar e reentrar na mesa, novos envios continuaram bloqueados. Conferir novamente resolveu o cancelamento e conservou os dois objetos.

O celular apresentou página de 382 px em viewport de 390 px, sem rolagem horizontal; botão de cancelamento com 44 px e operação por teclado. Arquivo de apoio ausente recebeu erro acessível, sem limpar a seleção. ADM em modo jogador ficou sem importação. Depois de retirar a simulação temporária de rede, o pacote GLTF/BIN/textura completo foi importado pelo fluxo normal. A simulação ficou fora do repositório e foi removida; não existe instrumentação de teste no produto.

Referência de implementação: [eventos nativos de upload](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload) e [abortar XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/abort).
