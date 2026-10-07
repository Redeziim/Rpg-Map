# Lixeira, exportação e atalhos das notas — itens 16, 17 e 18

Decisões do usuário em 2026-10-07: a lixeira só apaga quando é esvaziada; a exportação individual é em JSON, TXT e PNG (sem PDF).

## Lixeira (item 16)

- O dono da nota (o jogador, no caderno pessoal; o mestre ou ADM no modo mestre, no caderno do mestre) move a nota para a lixeira com o botão de lixeira no rodapé da janela. A nota guarda `trashed: true` e `trashedAt`, ganha uma versão nova (`trash`) e mantém todo o histórico.
- Nada apaga por idade. A lixeira só é esvaziada pelo dono, com confirmação; esvaziar remove as notas e o histórico de versões delas.
- Quem recebeu a nota compartilhada deixa de vê-la enquanto estiver na lixeira, no estado, no SSE e na exportação. Ao restaurar, o acesso volta como estava.
- Nota na lixeira não pode ser editada nem compartilhada (409); janelas abertas sem alterações se fecham sozinhas.
- Limites: 30 notas ativas por caderno e 60 no total, contando a lixeira. A nota original `legacy` não vai para a lixeira.
- API: `PATCH /notes/:escopo/:id/trash` com `{trashed, version}` e `DELETE /notes/:escopo/trash`.
- Teste: `tests/noteTrash.test.js` (permissões, versão, bloqueios, visibilidade para quem recebeu, passagem do tempo, restauração, limites, exportação, esvaziar, reinício, backup e restauração).

## Exportação (item 17)

Menu **Exportar** no rodapé da nota. O arquivo é gerado no navegador, com o que está na janela (inclusive alterações ainda não salvas, e o aviso diz isso).

| Formato | Conteúdo |
| --- | --- |
| Texto (.txt) | Título, texto, cartões do mapa mental com tipo, etiquetas e ponto do mapa, e as conexões |
| Imagem do mapa (.png) | O quadro inteiro com cartões, conexões, rótulos, traços e imagens, nas cores do app. Desativado quando o mapa mental está vazio |
| Dados completos (.json) | `grimorio-note` versão 1: título, texto e quadro, para reimportar no futuro |

Só a nota aberta sai; nada de outras pessoas. Funções em `src/components/noteExport.js`, teste em `tests/noteExport.test.js`.

## Atalhos e zoom (item 18)

- **Atalhos do teclado** em "Mais opções" do mapa mental: lista dos atalhos que o código realmente trata (N, setas, Enter/Espaço, Shift+clique, Delete, Esc, Ctrl+Z/Y, Ctrl+C/V, Ctrl+F e os do modo desenho). A lista vive em `BOARD_SHORTCUTS`, ao lado do código que os trata.
- **Zoom por pessoa**: o zoom escolhido fica guardado no navegador de quem o escolheu, por nota (`grimorio-board-zoom-v1:sala:caderno:nota`), e volta ao reabrir. Não vai para o servidor nem para os outros jogadores. Se o navegador bloquear o armazenamento, o zoom continua valendo na sessão.