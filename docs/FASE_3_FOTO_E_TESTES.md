# Questões por foto e testes

Implementação em C#: imagem → transcrição estruturada → conferência do aluno → busca por questão → resposta fundamentada. Fotos e respostas ficam em SQLite, separadas por disciplina. Sem fontes, não há resposta inventada. Respostas concluídas persistem antes da próxima chamada, permitindo retomada.

Testes: 18 unitários e 16 cenários de fluxo com xUnit, todos aprovados. As 56 verificações da regressão geral também passaram. HTTP Gemini simulado, sem consumo de cota. Leitura e acurácia em foto de prova real permanecem pendentes, conforme a disponibilidade do usuário. Próxima etapa solicitada: simplificar a interface.

Código: src/ColaAI.Web/Components/Pages/Photo.razor e serviços PhotoService, PhotoRules e GeminiVisionService. Testes: src/ColaAI.Tests. Execução: dotnet test ColaAI.Tests/ColaAI.Tests.csproj na pasta src.
