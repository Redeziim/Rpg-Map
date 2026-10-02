# Diagnóstico de requisições

A API responde com `X-Request-ID` em cada requisição `/api`. Em caso de erro, o mesmo identificador aparece no JSON. Use esse ID para localizar o evento no log do processo. `/api/health` continua retornando somente `{ "ok": true }`; não há painel ou rota pública de métricas.

Os eventos JSON usam apenas `requestId`, operação controlada (`auth`, `room`, `upload`, `save`, `export`, `sse`, `other`), resultado (`ok`, `validation`, `access`, `conflict`, `timeout`, `storage`, `internal`, `closed`), status HTTP, duração e número de bytes recebidos/enviados. Uploads, salvamentos e conexões SSE são registrados; outras operações só quando falham. Falhas durante um stream SSE geram evento adicional com o mesmo ID. O log não inclui caminho/consulta da URL, IP, cabeçalhos, cookie, conteúdo, nome de arquivo, mensagem da exceção ou identificador de mesa.

O processo limita a emissão a 60 eventos por minuto e mantém contadores em memória de cardinalidade fixa. Eventos excedentes são suprimidos, não armazenados em fila. Um destino de log indisponível não bloqueia a resposta nem o salvamento. Para retenção/rotação dos logs do serviço, configure o gerenciador do processo; este recurso não cria arquivos próprios. O registro administrativo da mesa é separado e segue suas permissões próprias.

Para investigar uma falha: anote o `X-Request-ID` na aba Rede do navegador, procure esse ID no log do servidor e confira operação, resultado, status e duração. `storage` aponta para uma exceção SQLite; `conflict` indica HTTP 409; `access` cobre 401/403; `validation` reúne os demais 4xx. Nenhum desses eventos revela o texto privado necessário para reconstruir uma ação.
