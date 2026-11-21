# Cola.ai · Fase 2 em C#

ASP.NET Core / Blazor Server em .NET 10. Interface e regras em C#; sem banco, hospedagem ou SDK pago. A extensão existente continua em JavaScript porque é executada pelo Chrome. Nenhuma chamada ao Gemini é feita ao importar o arquivo.

## Iniciar

Na pasta `src` deste projeto:

```sh
dotnet run --project ColaAI.Web/ColaAI.Web.csproj
```

Abra http://127.0.0.1:5180 e selecione `cola-ai-acervo-disciplina.json`. A tela mostra materiais, páginas, caracteres e limitações. A escuta é local (loopback). Não expor na rede sem implementar autenticação.

## Configurar Gemini

Crie uma chave em https://aistudio.google.com/api-keys usando um projeto SEM faturamento habilitado. Não envie a chave no chat ou salve em arquivos versionados. A aplicação não consegue detectar se sua conta tem faturamento: a gratuidade precisa estar configurada no projeto Google. Não habilitar billing para contornar cotas.

Em macOS, no mesmo terminal em que iniciará a aplicação, leia a chave sem mostrá-la na tela:

```sh
read -s 'cola_key?Chave Gemini: '
export Gemini__ApiKey="$cola_key"
unset cola_key
export Gemini__FreeTierProjectConfirmed=true
export DOTNET_ENVIRONMENT=Development
dotnet run --project ColaAI.Web/ColaAI.Web.csproj
```

Alternativa: .NET User Secrets (`Gemini:ApiKey`, `Gemini:FreeTierProjectConfirmed`) em ambiente Development. O UserSecretsId está no projeto. Não inserir a chave no código, frontend ou extensão.

Modelo padrão configurável: `gemini-3.5-flash-lite`. A documentação consultada em 18/11/2026 lista nível gratuito para entrada e saída padrão. Disponibilidade e cotas variam; não há troca automática de modelo, ativação de serviços ou novas tentativas. O modelo é configurável com `Gemini__Model` se necessário após verificar suporte ao nível gratuito.

## Base local, índice e resumos reaproveitáveis

O arquivo `ColaAI.Web/App_Data/cola-ai.db` é o acervo unificado em SQLite. Ele armazena disciplinas, textos por página, índice FTS5 e resumos. Não junta os documentos em um PDF nem remove a identificação das fontes. O banco fica fora do controle de versão e não é enviado ao Gemini.

- Importar o JSON valida os materiais, calcula identificadores estáveis a partir do nome/texto/páginas e salva uma transação local. Não usa tokens. Reimportação igual não duplica nem refaz o índice.
- O SHA do PDF recebido pela extensão não substitui a identificação do conteúdo textual realmente importado. Alterar texto, nome ou páginas invalida o resumo daquele documento.
- A lista Disciplinas salvas permite reabrir o acervo depois de reiniciar o servidor ou navegador.
- Busca local usa FTS5 por palavras, com remoção de diferenças de acentos. Preserva arquivo e página, divide páginas longas em trechos de até 2000 caracteres com sobreposição. Não é busca semântica; uma palavra diferente pode não encontrar o conceito. Nenhuma API de embeddings é necessária.
- Perguntar à IA envia a pergunta e até oito trechos recuperados, e valida as referências contra as páginas selecionadas. Se não houver resultados, não chama o Gemini. A busca não é usada para produzir o resumo geral, pois omitiria outros materiais.
- Resumo geral: gera e salva um resumo de CADA documento, considerando todo seu texto; depois envia somente os resumos para uma síntese temática. A primeira execução faz uma chamada por documento ainda não resumido e uma para consolidação. Não reduz necessariamente o consumo da primeira execução; economiza nas seguintes.
- Cada resumo individual fica salvo imediatamente após validação. Uma interrupção por cota ou cancelamento mantém os resultados concluídos. Um novo clique reaproveita os resumos e continua os faltantes. Não há retry automático nem fallback pago.
- Se nenhum conteúdo mudou, o resumo geral pronto é recuperado sem chamada à IA, inclusive sem chave configurada. Se um documento mudou, apenas ele é resumido novamente e a síntese é refeita. Modelo e versão do pipeline entram nas chaves do cache.
- O resumo individual aceita até 500 mil caracteres. A síntese também tem limite: se exceder, rejeita sem truncar. Uma futura divisão em subetapas será necessária para materiais maiores.
- Referências por página precisam existir; cada documento deve aparecer na síntese, e a síntese só pode usar referências já presentes nos resumos intermediários. Isso não verifica sustentação semântica ou cobertura de todos os conceitos. A síntese pode perder detalhes.
- Arquivos indisponíveis, páginas sem texto e cobertura de descoberta não confirmada continuam explícitos. Reimportação substitui a versão ativa da disciplina; materiais antigos saem da busca ativa, mas seu cache fica guardado e pode ser reaproveitado se voltarem.
- Fechar o navegador pode interromper geração em andamento; resumo concluído persiste. Não há fila de execução em segundo plano nesta versão.
- Dados locais não são criptografados pela aplicação. Para backup, pare o servidor e copie o banco; não copie enquanto há escrita. PDFs binários e imagens não estão incluídos no JSON importado.

## Verificação sem chave

```sh
dotnet run --project ColaAI.Checks/ColaAI.Checks.csproj
# Opcional: também validar o acervo local real (não incluído no repositório):
dotnet run --project ColaAI.Checks/ColaAI.Checks.csproj -- "/caminho/cola-ai-acervo-disciplina.json"
```

As verificações usam SQLite real temporário e transporte Gemini simulado, sem consumir cota. Testam persistência, reimportação, busca e isolamento por disciplina, retomada após 429, alteração de arquivo e economia de chamadas, além das validações de citações e importação.

## Próximos passos

Configurar a chave do projeto no nível gratuito e avaliar a qualidade de uma geração real. Importação automática da extensão e aplicativo mobile continuam como etapas posteriores. Não é necessário contratar serviços para usar a base local.

Referências: https://www.sqlite.org/fts5.html · https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/ · https://ai.google.dev/api/generate-content

## Cobertura da síntese

Os resumos individuais continuam obrigatoriamente validados. Se a consolidação temática omitir algum documento, a aplicação acrescenta uma seção explicitamente identificada como complemento por material, copiando o resumo individual já gerado e suas fontes originais. Não injeta referências em afirmações sem suporte. A resposta composta é novamente validada contra todos os documentos. A versão do cache da consolidação foi atualizada; os 19 resumos individuais existentes continuam reutilizáveis.

## Questões por foto

Abra Resolver questões por foto na disciplina ou /foto e escolha uma disciplina salva. Envie JPEG, PNG ou WebP de até 8 MB. A leitura usa imagem inline no Gemini e devolve enunciados editáveis, com todas as alternativas e avisos de legibilidade. Confira-os antes de Confirmar enunciados e resolver. Limite: dez questões e 8.000 caracteres por questão; não há truncamento silencioso.

Cada questão consulta os trechos da disciplina e recebe resposta com referências verificadas. Sem evidência recuperada, o sistema sinaliza a ausência sem chamar o modelo para inventar resposta. O índice é lexical, então isso não prova que o conceito esteja ausente do acervo.

Fotos, transcrições e respostas concluídas ficam no mesmo SQLite, por disciplina. Histórico mostra as últimas 30 sessões. Questões já concluídas não são reenviadas na retomada; editar enunciado ou mudar a versão do acervo/modelo invalida o reaproveitamento pertinente. Alterar o acervo em outra aba exige reabrir a disciplina antes de resolver.

A foto é enviada somente ao clicar em Ler questões; após leitura válida, fica salva localmente. A versão inicial trabalha com uma imagem por sessão. Não inclui correção das marcações do professor, várias fotos numa mesma prova ou XP. Leitura de imagem e exatidão das resoluções ainda precisam de teste com fotos reais; os testes automatizados não garantem qualidade do modelo.

## Testes da função por foto

```sh
dotnet test ColaAI.Tests/ColaAI.Tests.csproj
```

São 18 casos unitários de validação e 16 cenários de fluxo com SQLite temporário e HTTP Gemini simulado (34 no total). Não exigem chave, prova real ou cota. Cobrem formatos/tamanho, leitura ilegível, limites, persistência, isolamento por matéria, edição, referências inexistentes, falta de evidência, cota, cancelamento e retomada. O projeto ColaAI.Checks mantém a regressão mais ampla dos resumos e da busca.


## API para o iPhone

A API mobile fica desativada por padrão. `../scripts/start-mobile-backend.sh` descobre o IPv4 privado do Wi-Fi e ativa `MobileApi__Enabled=true` e `MobileApi__Host`. Rode o script no mesmo Terminal que já contém `Gemini__ApiKey` e `Gemini__FreeTierProjectConfirmed`; ele preserva essas variáveis. Não abra portas no roteador.

A página local `/mobile-setup` exibe o código gerado em `App_Data/mobile-access.key` e o endereço para o iPhone. Não envia nem mostra a chave Gemini. A página e toda a interface Blazor são bloqueadas para conexões da rede. Apenas `/api/mobile` aceita acesso remoto, sempre com `Authorization: Bearer <código>`, sem cookies ou CORS para sites. O tráfego HTTP é destinado à rede privada de confiança deste projeto.

Endpoints: `GET /health`, `POST /courses/import`, `GET /courses`, `GET /courses/{key}`, `POST /courses/{key}/summary`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, todos sob `/api/mobile`. Upload máximo de 20 MB, validado também para corpo sem Content-Length. A importação usa CorpusReader, IDs estáveis e SQLite FTS existentes. A geração roda em BackgroundService com progresso e snapshot do acervo; requisições repetidas para o mesmo trabalho ativo retornam seu ID. Um trabalho por vez; cache e validação das fontes usam StudyService. Tarefas/progresso são voláteis, resumos parciais e finais persistem no SQLite. Não há retries nem fallback de modelo.

Testes de integração usam servidor HTTP local, SQLite temporário e transporte Gemini simulado para verificar autenticação, proteção da interface web, importação/indexação, geração, cache, cota, cancelamento e idempotência durante um trabalho ativo. Nenhuma cota real é consumida.
