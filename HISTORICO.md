# Histórico recuperado do Cola.ai

O repositório foi preparado após o desenvolvimento e os testes locais. Os commits registram as etapas recuperáveis, sem alterar as datas para simular uma cronologia que não estava salva no Git.

| Etapa | Conteúdo | Origem |
| --- | --- | --- |
| Importador desktop 0.4.0 | Extensão Blackboard, descoberta de pastas, download e extração PDF | Código preservado da extensão |
| Resumos C# | Importação do acervo, integração Gemini e validação de citações | Snapshot real da primeira implementação C# |
| Índice e cache | SQLite/FTS5, resumos por material, consolidação e retomada | Snapshot real da etapa de indexação |
| Fotos e testes | Leitura de imagens, fluxo Blazor e testes com IA simulada | Snapshot real da etapa de fotos |
| API para iPhone | Acesso local autenticado, filtro de host e processamento acompanhado | Versão final do backend validado |
| Mobile consolidado V6 | Expo, importação iPhone, interface azul, câmera/histórico, biblioteca por disciplina e PDFs diretos | Estado consolidado recuperável do aplicativo |
| Exportação PDF | Resumo A4 justificado, títulos, referências e compartilhamento | Incremento separado sobre o mobile consolidado |
| Documentação | Como executar o projeto e limitações atuais | Estado atual |

## Sobre V1 a V6 do importador mobile

Esses números identificavam rodadas de teste do importador durante o desenvolvimento. Não existiam snapshots completos ou commits para cada rodada. Por isso, o repositório não apresenta versões intermediárias inventadas: a etapa mobile contém a versão consolidada V6 e os testes de regressão que reproduzem os problemas corrigidos.

Entre as correções preservadas estão a abertura de novas janelas do portal, o contexto da disciplina na navegação direta, a leitura da página real para evitar URLs desatualizadas do iOS, a separação entre acervos, a biblioteca de resumos e os links diretos de Engenharia de Software.

Os documentos em `docs/` incluem propostas históricas. Ideias como outros serviços de nuvem, simulados e gamificação não devem ser confundidas com funcionalidades já implementadas. O estado atual está no README principal.
