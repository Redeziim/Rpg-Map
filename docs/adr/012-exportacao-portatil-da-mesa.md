# 012 — Exportação portátil com projeção de permissões

Data: 2026-10-02. Estado: adotado.

## Contexto

O item 38 pede uma cópia completa por mesa que preserve privacidade. O PNG do mapa não carrega notas e recursos; URLs autenticadas deixam de funcionar fora da sessão. Copiar o snapshot administrativo diretamente incluiria notas individuais de terceiros que a exportação não deve divulgar.

## Decisão

- Adotar JSON UTF-8 versionado, com imagens e pacotes 3D incorporados. Incluir o estado conhecido permitido, fichas/status disponíveis, notas/quadros, versões autorizadas, coleção, objetos/pacotes da mesa 3D independente e registro administrativo quando permitido.
- Construir a projeção no servidor, respeitando papel e modo. Exportar notas pessoais de terceiros somente com compartilhamento explícito, inclusive para ADM/mestre. Aplicar a permissão histórica de cada versão e retirar referências a pontos ocultos.
- Proteger os pixels da imagem com o renderizador local da névoa. Recusar o arquivo se acesso/revisão mudar após operações assíncronas; revalidar também a transferência. A Mesa 3D permanece independente dos pontos 2D.
- Preparar em arquivo temporário, responder com resumo e entregar por download nativo após uma segunda verificação. Ler recursos sequencialmente e respeitar backpressure, sem Blob completo no navegador.
- Limitar tamanho, disponibilidade e concorrência; remover no cancelamento, erro, logout, download e encerramento normal. A manutenção após término abrupto fica no procedimento geral de temporários do item 39.
- Não alterar esquema/persistência, não acrescentar dependências e não incluir dados de autenticação ou rascunhos locais. Importação deste formato não faz parte desta entrega.

## Consequências

O arquivo é independente da sessão depois de baixado. A autorização protege a geração e a entrega, mas uma revogação posterior não pode apagar uma cópia já recebida. A exportação de jogador é uma projeção e não constitui um estado completo para restaurar o servidor. Copiar uma mesa administrativa também respeita privacidade de notas individuais; o backup integral do servidor segue outro procedimento, em `docs/RESTORE.md`.

Especificação e evidências em [ROOM_EXPORT.md](../ROOM_EXPORT.md). Três testes novos, 86 testes totais e build aprovados; download real e UI verificados em desktop e mobile.
