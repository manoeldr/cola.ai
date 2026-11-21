# Fase 2 — implementação C#

A decisão posterior do usuário substitui a proposta Node/React da arquitetura anterior: backend e interface novos em C# (.NET 10, ASP.NET Core, Blazor Server). Aplicação local de uso próprio, sem banco ou hospedagem nesta etapa. Extensão Chrome permanece em JavaScript.

Código e instruções em src/README.md. Acervo validado: 19 PDFs, 445 páginas, 217.042 caracteres. Importação não chama IA. Geração envia todo o texto em uma chamada Gemini; chave somente no servidor. Cotas encerram a operação sem retry/fallback. Gratuidade depende do projeto Google sem faturamento, não é verificável pela aplicação.

Validação: 14 verificações C# passaram, incluindo o acervo real, ausência de truncamento de entrada, rejeição de páginas inexistentes, documentos omitidos, resposta truncada e cota 429. Transporte Gemini simulado. Chamada real ainda depende de chave configurada pelo usuário.
