# Linha do tempo da campanha — preparação do item 57

## Estado atual

O usuário escolheu a opção recomendada: somente mestres/ADM no modo mestre criam e editam. Jogadores apenas consultam os registros liberados. A preparação contém o leitor React e funções de consulta/projeção; não aparece na navegação, não grava dados e não muda permissões ou esquema do banco. O item 57 permanece em andamento.

## Consulta preparada

- Diário com data na margem, título, texto, autor, tipo Sessão/Decisão e indicação Só mestres quando aplicável.
- Mais recentes primeiro: data do acontecimento, depois criação e identificador como desempate. Não ordenar só pela última edição.
- Página inicial de 20 registros; filtro de sessões/decisões, continuação e retorno aos mais recentes.
- Cursor com data/criação/identificador do último registro visível. A integração deverá acrescentar revisão da coleção e recusar cursor antigo depois de edição; não misturar páginas de versões diferentes.
- Datas no formato YYYY-MM-DD, validadas no calendário, sem conversão para o dia anterior por fuso horário. Renderização em português, com UTC explícito.
- Projeção reserva registros privados aos mestres, retira arquivados e filtra vínculos por pontos/cenas já autorizados. Um vínculo nunca libera seu destino nem revela o mapa.
- Leitor sem animação nova, foco visível, controles de 44 px, textos longos quebráveis, estados vazio/carregando/erro/reconectando e layout em uma coluna no celular.

## Integração depois da escolha

1. Aplicar a decisão registrada: escrita e gestão reservadas ao mestre/ADM no modo mestre; consultas de jogadores recebem apenas registros liberados. Conferir a autorização em cada endpoint, snapshot, SSE, vínculo e exportação.
2. Manter SQLite e APIs autenticadas existentes. Escolher armazenamento de entradas versionadas e registrar a migração explícita; preservar descritores históricos, backups, combate e mídia. Não adicionar serviço externo.
3. Expor consulta paginada e detalhe com acesso por papel/modo/visibilidade, sem nomes/IDs privados em snapshots, SSE, vínculos ou exportação. Respostas de página precisam informar revisão; mudança durante paginação pede atualização explícita.
4. Implementar criação/edição com data, tipo, título, texto e vínculos opcionais a pontos/cenas. Novos registros do mestre começam reservados; compartilhamento é explícito. Autoria vem da sessão, não do JSON enviado.
5. Exigir versão para edição/arquivamento. Conflito conserva o rascunho e permite revisar os campos, sem sobrescrever automaticamente. Reutilizar os mecanismos locais já autorizados, com confirmação antes de descartar.
6. Conectar o leitor à navegação como Linha do tempo. Abrir pontos/cenas por suas ações existentes; destino indisponível não amplia acesso. Arquivamento/restauração dependem da mesma política de edição definida no passo 1.
7. Exportar somente entradas e referências autorizadas. Conferir reinício, migração, rollback e recuperação por backup.

## Validação planejada

Limites públicos já usados e autorizados no projeto: API HTTP real e tela em `npm run dev`. Usar um fluxo integrado proporcional para ordenação/desempate/páginas, acesso, conflitos, reinício e exportação; não exigir três testes por feature. Navegador em desktop/celular e teclado. Leitor isolado usa apenas dados fictícios identificados como prévia.

Skills: `frontend-design`, `vercel-react-best-practices`, `tdd` no contrato HTTP após a escolha e `web-design-guidelines` na revisão. Nenhuma API externa necessária.

