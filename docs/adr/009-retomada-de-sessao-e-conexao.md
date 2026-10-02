# 009 — Retomada de sessão e conexão

- Estado: aceita
- Data: 2026-10-01
- Escopo: item 35; complementa [006 — migrações](006-migracoes-explicitas.md) e [008 — transações](008-transacoes-de-operacoes.md)

## Contexto

Encerrar o SSE sem informar a causa deixava o navegador tentando reconectar uma sessão expirada. Respostas HTTP podem chegar depois de eventos mais recentes; uma falha na entrega da resposta também pode ocorrer depois de o SQLite confirmar a alteração.

## Decisão

1. Diferenciar sessão inválida (401), participação removida (403) e queda de transporte. Enviar a causa de revogação no stream quando ele já está aberto; consultar a mesa para verificar o acesso antes de reconectar.
2. Fechar a conexão anterior, deduplicar a consulta e usar novas tentativas entre 3 e 30 segundos, antecipadas pelo retorno da rede ou da aba. Cancelar requisições e listeners no término da tela; manter o prazo HTTP de 20 segundos.
3. Conservar um snapshot confirmado separado do estado otimista. Descartar revisões inferiores e respostas anteriores nas revisões iguais. Aplicar mudanças de papel imediatamente, mesmo durante salvamentos, e manter a filtragem de conteúdo privado no servidor.
4. Após expiração, pedir novo login e retomar a mesa apenas para a mesma identidade e após consulta autorizada. Outra identidade retorna à lista de mesas. O destino de retomada fica na memória da página; as cópias locais existentes mantêm sua separação por conta e mesa.
5. Não promover versões dos editores nem reenviar alterações automaticamente. Manter o rascunho, consultar o estado após falha e informar a falta de confirmação. Conservar a revisão explícita de conflitos de notas e pontos.

## Consequências e limites

O snapshot inicial substitui a necessidade de reproduzir todos os eventos perdidos. O protocolo não mantém cursor durável nem resolve a distribuição entre réplicas. A política de sete dias das sessões, o esquema SQLite e a estratégia de persistência permanecem.

Uma requisição cancelada não desfaz uma transação já confirmada. A revisão protege os endpoints que já a exigem; não se introduziu idempotência universal nem fila offline. Rascunhos só podem ser recuperados após fechar o navegador quando há uma cópia local disponível. A última rolagem temporária da bandeja não é persistida por esta mudança.

Build e API devem ser publicados juntos para que o cliente reconheça a causa de revogação. Nenhuma dependência ou serviço externo foi acrescentado.

## Verificação

Três testes novos cobrem motivos de encerramento, acesso após novo login, papel atualizado, reinício, snapshot completo, privacidade, conflitos de versão e resposta perdida depois do COMMIT sem repetir histórico. A suíte de 77 testes e o build passaram. Navegador desktop e celular foram operados em banco descartável, incluindo recuperação de rascunho, comparação, troca de identidade e resposta HTTP antiga após mudança de papel. Procedimento e limites em [RECONNECTION.md](../RECONNECTION.md).
