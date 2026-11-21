# Cola.ai — prova de conceito Blackboard

Objetivo: verificar se os nomes e links necessários estão disponíveis na página do aluno. Esta versão não é uma integração completa: não baixa materiais, não chama APIs e não usa IA.

## Instalar no Chrome ou Edge no computador

1. Abra `chrome://extensions` (Chrome) ou `edge://extensions` (Edge).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione esta pasta `blackboard-importer` (não o ZIP).
4. Abra https://bb.cruzeirodosulvirtual.com.br/ultra/course e entre normalmente.
5. Abra a extensão pelo ícone de extensões e clique em **Analisar página aberta**.
6. Confira os candidatos e clique em **Salvar JSON** antes de fechar o painel.
7. Repita dentro de uma disciplina, com as pastas de materiais expandidas. Se necessário, role a página para carregar outros itens e analise novamente.

## Como avaliar o resultado

- Na lista de cursos, aparece o nome de uma disciplina real e seu link?
- Dentro dela, aparece o título correto e o link de pelo menos um material conhecido?
- O link abre o material normalmente quando clicado?
- Se aparecer só navegação ou nenhum material, isso é um resultado inconclusivo. Precisaremos ajustar os seletores à página real; não significa que o curso não tem arquivos.

Os tipos de links são heurísticas, não validação do conteúdo. Esta versão não entra em pastas automaticamente nem junta resultados de várias páginas. Frames de outra origem e conteúdo ainda não carregado podem ficar de fora.

## Dados

A leitura ocorre somente ao clicar e somente no domínio configurado. Sem servidor, telemetria, leitura de cookies ou armazenamento persistente. O JSON é salvo apenas a pedido e pode conter nomes de disciplinas e links com identificadores/parâmetros sensíveis: revise antes de compartilhar; não publique o arquivo. Remover a extensão encerra seu uso.

## Próximo marco

Validar a extração em uma conta real antes de implementar importação persistente, download de materiais ou o aplicativo mobile. O uso de `activeTab` não substitui regras de uso da instituição.

## Verificação do PDF (0.1.3)
Na tela do arquivo, analise a página e clique em **Verificar acesso ao PDF**. O teste solicita o recurso bbcswebdav da mesma origem na sessão do aluno, inspeciona até 1 KB do início da resposta e cancela a leitura. Não extrai texto nem envia dados a servidores externos. O JSON registra HTTP, tipo de conteúdo e presença da assinatura PDF. Não garante integridade ou leitura do arquivo completo.

## Versão 0.1.5
A verificação agora é executada no contexto da extensão, com permissões explícitas para o Blackboard da faculdade, basic-doc-viewer.us.api.blackboard.com e o host CDN observado no teste. Usa a sessão existente e segue redirecionamentos. Não desativa CORS nem altera cabeçalhos. Não exporta cookies ou URLs assinadas finais. Continua inspecionando apenas o início da resposta; uma resposta HTML do visualizador não confirma o PDF. A instalação pode solicitar acesso a esses três sites.

## Versão 0.1.6
Inclui permissão para o host intermediário alt-5d152e0e8981d.blackboard.com, identificado no redirecionamento real. O acesso ao PDF ainda depende de validação na sessão do aluno.

## Versão 0.1.7
Quando o endereço retorna HTML, testa o mesmo recurso sem os parâmetros render e isInlineRender, mantendo xythos-download=true. É uma hipótese de acesso ao download a validar, sem salvar o material ou remover restrições de acesso. O JSON registra o resultado das tentativas, sem URLs assinadas finais.

## Versão 0.1.8: PDF completo
Após analisar a tela do arquivo, clique em Baixar PDF completo e mantenha o painel aberto. A extensão recebe o arquivo em memória (limite 25 MB, 60 segundos), confere a assinatura e solicita o salvamento. O JSON registra tamanho e SHA-256, sem incluir os bytes ou o texto. O recebimento completo não equivale à validação estrutural do PDF. Não há extração de texto nesta etapa.

## Versão 0.2.0: texto por página
Após analisar a tela do PDF, clique em Extrair texto por página. Uma aba própria busca o PDF, calcula SHA-256 e extrai texto com PDF.js 5.6.205 (Apache-2.0, incluído no ZIP). Salve o material JSON com disciplina, arquivo e páginas, ou TXT. Nada é enviado para IA. Não há acervo persistente, RAG ou OCR nesta versão. Páginas sem texto são sinalizadas e a ordem de colunas pode exigir revisão. Limites: 25 MB e 500 páginas. PDFs protegidos podem falhar. É possível testar um arquivo local na mesma tela. Fechar a aba descarta o resultado não exportado.

## Versão 0.3.0: varredura experimental
Na página Conteúdo da disciplina, clique em Percorrer pastas da disciplina. Uma aba acompanha a execução e permite parar e exportar o diagnóstico. A varredura abre controles acessíveis reconhecidos, rola contêineres e acumula links. Não baixa arquivos em lote. A cobertura permanece não confirmada até comparar com o acervo real. Mantém as pastas abertas e a rolagem alterada; não navegue na disciplina durante a execução. Limites: 90 segundos, 150 expansões. Fechar a aba de acompanhamento não garante cancelamento; use Parar.

## Versão 0.3.1
Aguarda até 3,5 segundos pela expansão, reencontra controles substituídos por nova renderização, ignora referências antigas já abertas e permite até duas tentativas por controle. Diagnóstico registra controles sem confirmação. Não garante completude nem baixa o acervo em lote.

## Versão 0.4.0: lote
Use Importar lote de um diagnóstico no popup e selecione o JSON da varredura, ou Importar PDFs em lote após uma varredura. Clique em Importar arquivos encontrados e mantenha a aba aberta. Cria uma aba auxiliar inativa, visita somente os links /file da mesma disciplina e a fecha ao terminar/parar. Não abre avaliações. Salvar acervo e relatório exporta textos por arquivo/página, hashes, duplicatas e falhas. PDFs não são salvos individualmente. Limites: 100 arquivos, 25 MB/PDF, 500 páginas/PDF, 2 minutos/arquivo, 15 milhões de caracteres/lote. Falhas não interrompem outros arquivos. Parar cancela o arquivo atual e mantém resultados anteriores. Permissão storage usada apenas em storage.session para transportar o manifesto entre telas; resultado do lote ainda exige exportação. Não há retomada persistente após fechar a aba.
