# Cola.ai mobile — importação no iPhone

Expo SDK 58, TypeScript e Expo Router. Login no Blackboard, abertura de novas janelas e acesso nativo parcial a PDF foram confirmados pelo usuário no iPhone. O lote completo e a extração em WKWebView ainda precisam de validação no aparelho.

## Executar

Instale o Expo Go (https://expo.dev/go). Mac e iPhone precisam estar na mesma rede Wi-Fi.

```sh
cd "/Volumes/SSD Manoel/3_Academico/3_FSG/5_IA/Cola.AI/mobile"
npm start
```

Entre na mesma conta no Expo Go e na CLI (`npx expo login`), se solicitado. Leia o QR code com a Câmera do iPhone. Após atualizar o código, pressione `r` no Terminal. A identificação da versão é **IMPORTADOR · V2**.

## Importar

1. Abra **Estudar → Adicionar disciplina** (ou o botão +), conecte o Blackboard e abra a aba **Conteúdo** de uma disciplina.
2. Toque em **Importar disciplina**. Mantenha o aplicativo aberto e o iPhone desbloqueado durante o lote.
3. O app abre expansores reconhecidos, percorre a lista e reúne links de arquivo da disciplina. Avaliações são excluídas.
4. Cada arquivo é aberto na mesma WebView autenticada, baixado por fetch nativo sem Range e verificado como PDF completo (HTTP 200 + assinatura).
5. O PDF é salvo localmente e seu texto extraído por página com PDF.js empacotado, em uma WebView local separada. Nenhum material é enviado a serviços de IA.
6. Veja os resultados em **Ver acervo**. **Parar importação** preserva o trabalho salvo; **Retomar pendentes** tenta novamente somente arquivos ainda não concluídos, na mesma disciplina.
7. **Salvar acervo** abre o compartilhamento do iOS para salvar o JSON no app Arquivos ou transferir para o Mac. O formato é compatível com o importador C# existente (`schemaVersion: 1`, `source: blackboard-batch`).

Os PDFs ficam em `cola-ai-pdfs` e os acervos por disciplina em `cola-ai-acervos`, na área privada do aplicativo. O último acervo é restaurado ao abrir o app. No Expo Go esses arquivos pertencem à instalação do Expo Go; exporte o JSON antes de remover o aplicativo ou limpar seus dados. O JSON contém o conteúdo dos materiais, sem cookies ou parâmetros de URLs de download.

## Limites e cobertura

A varredura dura até 90 segundos, abre até 150 expansores e aceita até 100 arquivos. Limites por PDF: 25 MB, 500 páginas, 5 milhões de caracteres; por lote: 250 MB de PDFs, 15 milhões de caracteres e JSON de até 20 MB. Arquivos não PDF, protegidos ou incompatíveis são marcados com erro e não impedem os próximos. Páginas sem texto são marcadas como **precisam de OCR**; OCR ainda não está implementado.

A cobertura total da disciplina permanece **não confirmada**, mesmo quando todos os arquivos encontrados foram importados. Conteúdo em pastas não reconhecidas, links externos ou fora da lista observada pode ficar de fora. Não há promessa de sincronização automática em segundo plano no iOS.

## Verificar e reconstruir

```sh
npm run typecheck
npm run lint
npm test
npm run build:pdf
npx expo export --platform ios
```

Nove testes verificam isolamento da disciplina, exclusão de avaliações, deduplicação de links, distinção entre PDF parcial/completo, páginas/OCR e script de descoberta. O leitor empacotado também foi testado em navegador com um PDF sintético de uma página. Isso não substitui o teste do lote no iPhone.

`src/generated/pdf-engine.json` é produzido de PDF.js e seu worker pelo script `build:pdf`, sem CDN. `course-crawler.json` contém a varredura adaptada da extensão de desktop. A licença de PDF.js está em `licenses/pdfjs-LICENSE`.


## Resumos pelo aplicativo

O botão **Resumos** abre a conexão ao backend C#. O Mac precisa estar ligado, com o servidor em execução e na mesma rede Wi-Fi do iPhone.

No Terminal em que a chave Gemini já foi configurada, pare o servidor antigo com Ctrl+C e execute:

```sh
zsh "/Volumes/SSD Manoel/3_Academico/3_FSG/5_IA/Cola.AI/scripts/start-mobile-backend.sh"
```

No Mac, abra `http://127.0.0.1:5180/mobile-setup`. A página exibe o endereço privado do Mac e o código de acesso, diferente da chave Gemini. No iPhone, preencha os dois em **Resumos → Conectar ao Mac**. O código fica no SecureStore, não no acervo ou na WebView do Blackboard.

Toque em **Enviar acervo do iPhone**, confira os totais e use **Gerar ou retomar resumo geral**. A geração continua no Mac se o aplicativo for fechado; ao voltar, a tela acompanha o processamento existente. Não há nova chamada ao Gemini só por acompanhar o andamento. Uma falha de cota encerra o processamento; outra tentativa depende do botão do usuário e reutiliza os resumos individuais concluídos. Após reiniciar o servidor, tarefas em memória não existem mais, mas os resumos salvos em SQLite continuam disponíveis para retomada.

O resultado, com nomes de materiais e páginas citadas, é salvo no iPhone para leitura posterior sem conexão. A importação de um acervo incompleto é bloqueada nesta tela. A chave Gemini e a confirmação do nível gratuito continuam nas variáveis de ambiente do backend; não coloque a chave no aplicativo.

O modo Wi-Fi usa HTTP na rede privada para este projeto local. Utilize sua rede de confiança: o tráfego local não tem a criptografia de HTTPS. Somente `/api/mobile` fica disponível pela rede, com código de acesso; a interface Blazor, fotos e a página de pareamento continuam limitadas ao próprio Mac. Sem esse modo, o backend continua restrito a loopback. Não há hospedagem ou serviço pago adicionado.


## Interface mobile

A tela inicial **Foto** usa azul, ícone de câmera grande em círculo e menu inferior em ilha flutuante: **Estudar / Foto / Histórico**. **Estudar** apresenta o último acervo importado e abre o resumo salvo. Importação e diagnóstico ficam na rota **/importar**, acessível pelo botão + ou atualização dos materiais. As rotas anteriores de resumo e os arquivos de dados foram preservados.

**Resumos:** configurações de conexão ficam recolhidas depois de configurar o Mac e podem ser abertas pela engrenagem. **Gerar resumo geral** envia o acervo e inicia a geração em uma só ação. Se a versão já tiver resumo no Mac, ele é reutilizado. O resumo salvo abre diretamente para leitura; materiais e cobertura ficam em uma seção expansível. A atualização é explícita, sem geração automática ao abrir uma tela.

**Câmera e Histórico:** a câmera pede permissão somente no fluxo de captura, fotografa, permite refazer e salva a página. Fotos são guardadas na área privada do app, em `cola-ai-photos`, com disciplina atual e data. O histórico mostra essas páginas e a última revisão salva. Não grava áudio nem publica fotos. Limite local: 100 páginas fotografadas. A nova tela de captura e o armazenamento de fotos ainda precisam ser testados no iPhone real.

A captura nativa ainda não envia fotos para a resolução por IA: **o gabarito por foto não está conectado nesta versão**. Não existem alternativas simuladas ou respostas fictícias. O fluxo de foto do Blazor permanece separado até a integração específica para retornar somente as alternativas.

Após atualizar dependências e rotas, reinicie o Terminal do Expo com `npx expo start --clear` e abra o novo QR code. O cache do Metro pode ser limpo sem apagar o acervo, a conexão ou o resumo salvo no iPhone. O backend pode continuar em execução.

A interface foi inspecionada em uma prévia web de 390 × 844; arquivos e câmera nativos são validados no aparelho. `react-native-web` serve a essa prévia e não transforma o importador em um aplicativo web funcional.


## Biblioteca por disciplina

**Estudar** lista todos os acervos e resumos salvos, com uma ação por disciplina. **Histórico** também apresenta todas as revisões locais. A rota `/resumos` recebe `source` (URL de origem da disciplina) ou `courseKey` (identificador no backend), sem reaproveitar a revisão de outra matéria. **Preparar revisão** no importador encaminha a disciplina desse lote explicitamente.

O arquivo antigo `cola-ai-study-state.json` continua existindo como ponte de compatibilidade, mas cada revisão passa a ser arquivada em `cola-ai-resumos/<courseKey>.json`. Antes de trocar a disciplina ativa, a revisão anterior é migrada. Os acervos existentes em `cola-ai-acervos` são lidos pela biblioteca. Para dados antigos sem URL de origem, a associação ao acervo só acontece se houver correspondência única de título; quando ambígua, o resumo permanece acessível pelo identificador próprio e nunca é atribuído a outra disciplina.

**Buscar resumos salvos no Mac** consulta a biblioteca do backend e baixa os resumos já gerados para o iPhone. É uma operação de leitura e armazenamento local, sem gerar resumos nem chamar Gemini. O botão é útil para recuperar revisões que tenham sido feitas no Mac ou ainda não estejam arquivadas neste aparelho. O acervo enviado ao gerar ou atualizar um resumo é sempre o da disciplina selecionada, não o último arquivo importado globalmente.

Testes incluem seleção isolada entre IA e Engenharia de Software, ausência de fallback para outra matéria e migração do formato antigo com persistência de duas revisões após reabrir o armazenamento.


Importador V4: ao navegar entre disciplinas, o resultado ativo passa a ser carregado pelo ID da disciplina da WebView. O último acervo global não é restaurado como resultado da tela. Ao iniciar um lote, o relatório anterior é retirado da tela e a URL/título são consultados diretamente em `location`, antes de validar a aba Conteúdo e executar a varredura. A origem do resultado da varredura deve coincidir com a disciplina identificada. Falhas deixam o novo resultado vazio e mostram o motivo; os acervos antigos continuam preservados na biblioteca. Testes de fluxo simulam o callback nativo ainda apontando para IA enquanto o documento real é Engenharia de Software.


Importador V6: links diretos `/bbcswebdav/` com indicação PDF também são coletados dentro da disciplina. Como esses caminhos não contêm o ID do curso, a fila exige a origem observada da varredura da disciplina. Eles são baixados por fetch nativo, sem tentar abrir uma rota Ultra `/file/`. Parâmetros completos das URLs ficam apenas em memória durante o lote; o acervo e o diagnóstico salvam caminhos sem query. Na retomada, a descoberta atualiza os endereços dos downloads diretos pendentes. DOCX e outros arquivos sem indicação PDF ficam em `discovery.unsupported`, visíveis no resultado, e não são enviados ao extrator PDF.

O diagnóstico real de Engenharia de Software foi reproduzido localmente: 12 candidatos PDF diretos aceitos e um DOCX excluído. Os testes simulam download direto completo, seleção por disciplina e ausência de parâmetros de download no JSON persistido. O lote no iPhone continua sendo a validação de integração com a sessão real.


## Exportar resumo em PDF

Depois de gerar ou abrir uma revisão salva, **Exportar resumo em PDF** cria um documento A4 local com texto justificado, parágrafos, títulos numerados, identificação da disciplina, data do resumo, fontes por seção e lista dos materiais citados. A apresentação acompanha o azul do Cola.ai. O compartilhamento nativo permite salvar no app Arquivos ou escolher outro destino. Funciona com o resumo salvo, sem Mac conectado e sem chamar Gemini.

O HTML é gerado a partir de texto escapado, sem scripts, imagens remotas ou carregamento de fontes pela internet. Não inclui chave Gemini nem código de acesso do Mac. Fontes sem identificação são rejeitadas, em vez de substituídas por atribuições inventadas. A cópia final fica no cache do app com nome da disciplina; salve em Arquivos para mantê-la fora do cache. `expo-print` está incluído no Expo Go SDK 58; reinicie o Expo com `npx expo start --clear` após atualizar a dependência.

Testes cobrem justificação/A4, preservação das citações e seções, bloqueio de HTML injetado e nomes de arquivo seguros. O compartilhamento e a paginação final do gerador iOS ainda precisam ser confirmados no iPhone.
