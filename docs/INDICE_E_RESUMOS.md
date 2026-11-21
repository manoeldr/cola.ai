# Acervo persistente e redução de chamadas

Implementado em C#: SQLite local com FTS5, disciplinas salvas e busca por trechos com arquivo e página. O índice é lexical; não usa embeddings ou tokens. O resumo geral passa por todos os materiais, com cache individual e consolidação; não depende dos trechos da busca.

Resumos são identificados pelo conteúdo textual, modelo e versão do pipeline. Alterar um documento refaz só seu resumo e a síntese geral. Repetir sem alterações usa o resumo geral salvo sem chamada. A primeira execução pode gastar mais tokens que uma chamada única; o ganho está no reaproveitamento posterior. Interrupção por cota preserva resultados e retoma por novo clique, sem fallback ou retry automático.

Dados: src/ColaAI.Web/App_Data/cola-ai.db. Não versionar esse arquivo. Mais detalhes em src/README.md. Referências validadas estruturalmente não garantem sustentação semântica nem cobertura completa do Blackboard.
