# Transferência de modelos da Mesa 3D

Item 42, validado em 2026-10-02. A Mesa 3D independente usa os mesmos objetos e o mesmo SQLite. O transporte binário evita transformar arquivos locais em data URLs e decodificar antecipadamente todas as dependências no navegador. Não há migração, API externa ou dependência nova.

A entrega seguinte acrescentou [conferência de conteúdo](MODEL_VALIDATION.md) antes de salvar e [qualidade/movimento pessoais](TABLETOP_QUALITY_AND_MOTION.md). A ausência de dependência nova acima descreve especificamente o item 42.

## Uso e compatibilidade

Em **Mapa → Mesa 3D**, selecione o modelo e seus arquivos de apoio. GLB com recursos incorporados é a opção mais simples; GLTF pode precisar de BIN e texturas, e OBJ pode precisar de MTL e texturas. FBX e PNG/JPEG/WebP continuam disponíveis. Draco/KTX2 e reprodução de animações não estão habilitados.

Mestre e ADM em modo mestre importam e alteram objetos. Jogador e ADM em modo jogador usam a câmera e consultam objetos. O cliente envia `mapViewMode` também nas escritas da Mesa 3D; a API valida o papel e o modo. Clientes antigos sem esse parâmetro continuam sujeitos às permissões do papel real.

Pacotes já salvos e clientes antigos continuam usando JSON/base64. O servidor novo atende JSON ou binário; o cliente novo também lê a resposta JSON de um servidor antigo. Os arquivos continuam incorporados nos backups e na exportação portátil da mesa. Movimentos de objetos não reenviam o pacote.

## Contrato HTTP

- Publicação: `POST /api/rooms/:roomId/map-assets?mapViewMode=master`, com sessão, CSRF e `Content-Type: application/vnd.grimorio.map-asset`.
- Leitura: `GET /api/rooms/:roomId/map-assets/:assetId`, com `Accept: application/vnd.grimorio.map-asset` e acesso atual à mesa.
- Sem a negociação binária, o contrato JSON anterior permanece disponível. A resposta da publicação conserva o formato de objeto já existente.

O corpo binário é composto de:

1. Quatro bytes ASCII `GRM1`.
2. Quatro bytes com o tamanho do cabeçalho JSON, inteiro sem sinal em ordem big-endian.
3. Cabeçalho JSON em UTF-8.
4. Conteúdo de cada arquivo, concatenado na ordem declarada, sem separador nem padding.

Exemplo de cabeçalho:

```json
{
  "version": 1,
  "main": "modelo/casa.gltf",
  "kind": "structure",
  "files": [
    {"name": "modelo/casa.gltf", "mime": "model/gltf+json", "size": 1200},
    {"name": "modelo/mesh.bin", "mime": "application/octet-stream", "size": 4096}
  ]
}
```

`kind` aceita `terrain` ou `structure`. `size` é a quantidade exata de bytes daquele arquivo; `main` precisa identificar um arquivo principal suportado. Metadados desconhecidos, nomes duplicados sem considerar maiúsculas/minúsculas, caminhos recusados, versão desconhecida, corpo incompleto e bytes extras são rejeitados. O MIME declarado é metadado, e não comprovação do conteúdo; a validação profunda pertence ao item 43.

## Limites e processamento

| Limite | Valor |
| --- | --- |
| Conteúdo bruto por pacote | 50 MiB |
| Arquivos por pacote | 1–100, sem arquivo vazio |
| Cabeçalho JSON | Até 64 KiB |
| Nome de arquivo | Até 240 caracteres |
| Objetos por mesa | 100, limite existente |
| Arquivos acumulados por mesa | 300 MiB, limite existente |

A leitura do POST confere prefixo e metadados antes de reservar o conteúdo de um arquivo. O servidor processa um arquivo por vez e o converte para o JSON/base64 persistido. O GET escreve com backpressure e blocos de até 64 KiB, decodificando um arquivo por vez. O banco ainda contém o pacote JSON completo; essa mudança reduz cópias de transporte e carregamento, sem prometer um teto para todo o heap do processo.

No navegador, File/Blob são usados diretamente. O pacote recebido fica em Blob; `slice()` separa seus arquivos sem criar um ArrayBuffer completo do pacote. O arquivo principal é lido para o loader e as URLs das dependências são preparadas quando necessárias. Fontes legadas são decodificadas somente quando usadas. Texto é lido em UTF-8. As URLs temporárias são revogadas ao concluir ou falhar.

A fila conserva no máximo dois carregamentos. Retirar um objeto ou sair da cena aborta downloads pendentes; um modelo cujo processamento termina depois da saída é descartado. Isso não representa uma interface completa de cancelamento/progresso de importação, prevista no item 46.

## Acesso e cache

Permissões são conferidas antes da leitura do POST e novamente antes da gravação. Downloads verificam sessão, participação e existência do recurso antes da resposta e durante a escrita. Cache é privado e exige revalidação, com `Vary: Cookie, Accept`. A representação binária usa ETag com sufixo `.binary-v1`, diferente da representação JSON. Uma resposta 304 só é emitida depois de validar o acesso atual.

O formato não muda as permissões de notas, imagens ou pontos e não cria cena 3D por ponto 2D.

## Medição reproduzida

Fixture local: OBJ de 6.291.445 bytes com comentários e uma malha pequena, acompanhado de um arquivo de apoio não usado de 12.582.912 bytes. Total bruto: 18.874.357 bytes. Node 24.19.0 no Windows; os valores abaixo são contagens de bytes desse cenário, sem compressão HTTP.

| Medida | Antes do item 42 | Loader atual com JSON legado | Transporte binário e Blob |
| --- | ---: | ---: | ---: |
| Bytes do corpo transferido | 25.165.984 | 25.165.984 | 18.874.554 |
| Bytes decodificados de base64 pelo loader | 25.165.802 | 6.291.445 | 0 |
| Bytes materializados em Blobs/URLs de apoio pelo loader | 18.874.357 | 0 | 0 |

O POST pela interface registrou os mesmos **18.874.554 bytes**. A redução do corpo foi de aproximadamente 25% nessa fixture. O apoio não usado não exigiu URL; um modelo com textura usada continua precisando carregar essa textura. Essas medidas não representam todo o heap, memória GPU, FPS ou todos os formatos.

## Validação e próximos itens

- Três testes novos cobrem transporte e bytes, JSON legado, cache/acesso, limites, corpo inválido, exportação/reinício e loaders reais de OBJ, GLTF e GLB com fontes legadas e Blob.
- A regressão dos subprocessos de diagnóstico no Windows foi corrigida usando `fileURLToPath` para o diretório de trabalho. Suíte completa: **98 testes, sem falhas**; build aprovado, com o aviso conhecido de tamanho do bundle Three.js.
- `npm run dev`, banco descartável, desktop de 1440 px e celular de 390 px: importações reais de OBJ/MTL/textura, GLTF/BIN/textura, GLB com textura, FBX e imagem como terreno; arquivo de 18 MiB; erro de material ausente; teclado; reabertura depois do reinício e saída/retorno da cena. ADM em modo jogador não recebeu controles de importação/edição. A página estreita não apresentou overflow horizontal.

Validação de conteúdo no servidor é o **43**; auditoria completa de descarte é o **44**; recuperação de WebGL é o **45**; progresso e cancelamento de importação são o **46**. Os ensaios atuais não substituem essas etapas.
