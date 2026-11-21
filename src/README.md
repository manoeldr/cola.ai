# Cola.ai · Fase 2 em C#

ASP.NET Core / Blazor Server em .NET 10. Interface e regras em C#; sem banco, hospedagem ou SDK pago. A extensão existente continua em JavaScript porque é executada pelo Chrome. Nenhuma chamada ao Gemini é feita ao importar o arquivo.

## Iniciar

Na pasta `src` deste projeto:

```sh
dotnet run --project ColaAI.Web
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
dotnet run --project ColaAI.Web
```

Alternativa: .NET User Secrets (`Gemini:ApiKey`, `Gemini:FreeTierProjectConfirmed`) em ambiente Development. O UserSecretsId está no projeto. Não inserir a chave no código, frontend ou extensão.

Modelo padrão configurável: `gemini-2.5-flash-lite`. A documentação consultada em 17/11/2026 lista nível gratuito para entrada e saída padrão. Disponibilidade e cotas variam; não há troca automática de modelo, ativação de serviços ou novas tentativas. O modelo é configurável com `Gemini__Model` se necessário após verificar suporte ao nível gratuito.

## Comportamento

- Importação valida formato, status e numeração. Arquivos que falharam são explicitamente excluídos com aviso; duplicatas precisam apontar para original com mesmo hash.
- Geração envia TODO o texto dos documentos elegíveis, com ID e página, em uma chamada. Limite inicial de 500 mil caracteres: se exceder, rejeita sem truncar. Envio de texto, sem imagens dos PDFs.
- Resposta JSON estruturada com seções e fontes. Cada fonte precisa existir e cada documento precisa ter ao menos uma referência. Isso valida a estrutura, não prova sustentação semântica ou cobertura de cada conceito.
- Respostas incompletas, citação inexistente e documentos omitidos são rejeitados. HTTP 429 encerra, sem fallback ou retry. Cancelamento disponível.
- Exporta resumo e mapa de documentos em JSON; fontes citadas podem ser conferidas na tela.
- Dados em memória por sessão, sem gravação automática de acervo ou chave. Nenhum segredo em logs da aplicação. Sem resumo fictício ou modo de demonstração apresentado como IA real.

## Verificação sem chave

```sh
dotnet run --project ColaAI.Checks
# Opcional: também validar o acervo local real (não incluído no repositório):
dotnet run --project ColaAI.Checks -- "/caminho/cola-ai-acervo-disciplina.json"
```

As verificações usam transporte HTTP simulado e não consomem cota. Testam importação, documentos omitidos, referências inválidas, limites e interrupção por cota/truncamento.

## Próximos passos

Validar uma resposta real com chave no nível gratuito; avaliar qualidade e referências. Só depois implementar processamento hierárquico/retomada se o acervo ou a cota exigirem, persistência local e integração direta da extensão. O resumo cobre o acervo fornecido, não garante descoberta de todo o Blackboard.

Referências: https://ai.google.dev/api/generate-content · https://ai.google.dev/gemini-api/docs/structured-output · https://ai.google.dev/gemini-api/docs/pricing
