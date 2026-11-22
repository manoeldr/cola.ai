# Cola.ai

Assistente acadêmico de uso pessoal, desenvolvido por **Manoel Rodrigues** e **Uilsom Cardoso** para um projeto da Faculdade da Serra Gaúcha (FSG).

O aplicativo importa materiais do Blackboard pelo iPhone, extrai o texto dos PDFs e usa um backend C# para preparar resumos com referências. As revisões ficam organizadas por disciplina e podem ser exportadas como PDFs formatados.

## O que funciona

- Login no Blackboard em uma WebView, incluindo abertura do portal em nova janela.
- Varredura de pastas, download autenticado de PDFs e extração local do texto por página.
- Suporte tanto às páginas de arquivo do Ultra quanto a links diretos `/bbcswebdav/`.
- Biblioteca com vários acervos e resumos, selecionados por disciplina.
- Indexação SQLite/FTS5 e geração hierárquica de resumos pelo Gemini, com cache e referências verificadas.
- Retomada dos resumos individuais concluídos quando há interrupção de cota, sem repetição automática ou troca de modelo.
- Exportação do resumo salvo para PDF A4, com texto justificado, títulos e fontes.
- Mapa mental independente do PDF, com temas e tópicos curtos, zoom, consulta offline e exportação SVG.
- Interface azul com câmera em destaque e navegação inferior flutuante.
- Captura e histórico local de fotos no iPhone.

**Limites atuais:** o gabarito por foto ainda não está integrado ao aplicativo Expo; o fluxo de leitura/resolução do Blazor é separado. DOCX e outros formatos não são extraídos pelo importador mobile. A cobertura total de uma disciplina no Blackboard não é garantida: o app informa o que encontrou, o que importou e o que ficou pendente. Não há sincronização em segundo plano no iOS.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `mobile/` | Aplicativo Expo SDK 58, React Native e TypeScript |
| `src/ColaAI.Web/` | Backend ASP.NET Core/Blazor, API mobile e integração Gemini |
| `src/ColaAI.Tests/` | Testes automatizados com transporte de IA simulado |
| `src/ColaAI.Checks/` | Verificações de regressão do pipeline |
| `blackboard-importer/` | Extensão de desktop usada na primeira etapa |
| `scripts/` | Inicialização do backend na rede local do Mac |
| `docs/` | Planejamento e registros das fases do projeto |

## Executar no Mac e no iPhone

Pré-requisitos: .NET SDK 10, Node.js 24, npm e Expo Go no iPhone. Mac e iPhone devem estar na mesma rede Wi-Fi.

```sh
git clone https://github.com/manoeldr/cola.ai.git
cd cola.ai
```

No primeiro Terminal, configure a chave obtida no [Google AI Studio](https://aistudio.google.com/app/apikey). O comando abaixo solicita a chave sem exibi-la:

```sh
read -r -s 'cola_key?Cole a chave Gemini e pressione Enter: '
```

Depois de colar a chave e pressionar Enter, execute no mesmo Terminal:

```sh
export Gemini__ApiKey="$cola_key"
unset cola_key
export Gemini__FreeTierProjectConfirmed=true
zsh scripts/start-mobile-backend.sh
```

A confirmação acima é para um projeto Google configurado no nível gratuito. O aplicativo não verifica o faturamento da conta. Não habilita serviços pagos nem faz fallback automático.

Abra **http://127.0.0.1:5180/mobile-setup no Mac**. A página mostra o endereço privado do computador e o código de conexão para o app; esse código é diferente da chave Gemini.

Em um segundo Terminal, a partir do repositório:

```sh
cd mobile
npm ci
npx expo start --clear
```

Escaneie o QR code com a câmera do iPhone e abra no Expo Go. Se solicitado, entre na mesma conta Expo no celular e na CLI (`npx expo login`).

1. Em **Estudar**, adicione uma disciplina e abra seu **Conteúdo** no Blackboard.
2. Em **Ações**, importe os materiais e confira o resultado.
3. Abra a revisão da disciplina e configure a conexão ao Mac pela engrenagem.
4. Toque em **Gerar resumo geral**. O envio do acervo e a geração são uma única ação.
5. Use **Exportar resumo em PDF** para salvar a revisão no app Arquivos.

A geração roda no Mac. Revisões já salvas podem ser lidas e exportadas no iPhone sem nova chamada à IA. Consulte os detalhes em [mobile/README.md](mobile/README.md) e [src/README.md](src/README.md).

## Testes

```sh
dotnet test src/ColaAI.Tests/ColaAI.Tests.csproj
dotnet run --project src/ColaAI.Checks/ColaAI.Checks.csproj
```

```sh
cd mobile
npm ci
npm run typecheck
npm run lint
npm test
```

Os testes usam dados sintéticos e respostas Gemini simuladas, sem chave real nem consumo de cota. Login, download e geração foram também testados no iPhone durante o desenvolvimento. A pasta da extensão possui seus próprios testes Node.

## Dados e execução local

Chaves, códigos de conexão, bancos SQLite, acervos, provas, PDFs de disciplinas, dependências e saídas geradas não fazem parte do repositório. As credenciais ficam no servidor e no armazenamento seguro do aparelho, conforme sua finalidade.

O backend permanece limitado a loopback por padrão. O script de inicialização ativa somente o IP privado do Mac; a API exige código de acesso e a interface web continua limitada ao computador. O modo local usa HTTP e deve ser usado na rede de confiança do projeto, sem expor portas à internet.

## Histórico

Os commits foram organizados pelas etapas recuperáveis do desenvolvimento: extensão, resumos C#, indexação, fotos/testes, API para iPhone, aplicativo mobile consolidado e exportação PDF. Veja [HISTORICO.md](HISTORICO.md) para o que foi recuperado de snapshots e o que foi consolidado.

As licenças dos componentes de terceiros estão preservadas nas respectivas pastas, incluindo o template Expo e o PDF.js.

### Chave Gemini pelo aplicativo

Abra a engrenagem → Configurações. Conecte ao Mac com endereço e código exibidos em `http://127.0.0.1:5180/mobile-setup`. Na primeira configuração, copie também o identificador de segurança dessa página. Cole a chave Gemini, confirme o nível gratuito e toque em **Salvar e aplicar chave**. Salvar não consulta o Gemini: a validade será confirmada na próxima geração.

A chave fica no SecureStore do iPhone e somente na memória do backend. Após reiniciar o backend, toque em **Aplicar chave salva**; exportar a chave no Terminal é opcional. O servidor continua precisando rodar no Mac. **Esquecer chave no iPhone** remove a cópia local, sem alterar a sessão ativa no Mac.

O envio usa RSA-OAEP/SHA-256 com aleatoriedade nativa e identifica o destinatário pelo SHA-256 da chave pública, conferido com o identificador copiado do Mac. Isso protege o conteúdo da chave mesmo com HTTP local; não transforma toda a conexão em HTTPS. A identidade RSA persiste em `App_Data/settings-rsa.pem` (ignorado pelo Git); a chave Gemini não é gravada no Mac. Se apagar esse arquivo, confira e atualize o identificador no aplicativo.

Para receber esta atualização, reinicie o backend e o Expo (`npx expo start --clear` dentro de `mobile`). Não é necessário criar um novo build nativo: Expo Crypto e SecureStore estão disponíveis no Expo Go.
