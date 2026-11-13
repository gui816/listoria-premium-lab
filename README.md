# Lista Família

Lista de compras familiar, mobile-first, com listas partilhadas, categorias, quantidades e sincronização em tempo real.

## Funcionalidades

- Criar uma lista e partilhá-la apenas através de um código.
- Entrar numa lista existente com o código, sem precisar de uma página web ou link de convite.
- Adicionar e remover artigos, definir quantidade e categoria.
- Marcar artigos como comprados e limpar os concluídos.
- Atualizações em tempo real entre dispositivos através de Supabase Realtime Broadcast.
- Interface responsiva em português europeu.
- Persistência PostgreSQL gerida pelo Supabase; sem servidor Express, MongoDB ou Socket.IO.

## Configurar o Supabase

1. Cria um projeto em [supabase.com](https://supabase.com/).
2. Abre **SQL Editor**, cria uma query e executa todo o ficheiro `supabase/migrations/202610090001_initial_schema.sql`.
3. Em **Project Settings → API**, copia o Project URL e a chave publishable (ou anon legacy).
4. Copia `.env.example` para `.env.local` e preenche `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Instala dependências e arranca a aplicação:

```bash
npm install
cp .env.example .env.local
# Edita .env.local com os dados do teu projeto
npm run dev
```

Abre o endereço local indicado pelo Vite.

## Importar compras com Gemini

A aplicação suporta importação de produtos por fotografia de uma lista manuscrita e por voz. A voz usa o reconhecimento de fala disponível no navegador/dispositivo e envia a transcrição para o Gemini; a fotografia é enviada diretamente ao Gemini. Os produtos e quantidades são apresentados numa pré-visualização editável antes de serem adicionados.

Para builds Android através do GitHub Actions:

1. Em **Settings → Secrets and variables → Actions**, cria o secret `GEMINI_API_KEY` com uma chave criada no [Google AI Studio](https://aistudio.google.com/apikey).
2. Executa o workflow **Android APK** (automaticamente em cada push para `main`, ou manualmente em **Actions**).
3. Se o secret não existir, o APK continua a compilar, mas a importação por IA mostra uma mensagem a pedir a configuração da chave.

O workflow injeta o secret em `VITE_GEMINI_API_KEY` apenas durante `npm run build`. Como o Vite incorpora variáveis `VITE_*` no JavaScript do cliente, a chave pode ser extraída do APK; usa uma chave exclusiva para esta app e configura limites/alertas de utilização na Google AI. A fotografia e a transcrição de voz são enviadas à Google para processamento. Para desenvolvimento local, define `VITE_GEMINI_API_KEY` no teu `.env.local`.


## Comparação inteligente do cabaz

A comparação gratuita utiliza um catálogo de países e supermercados mantido no Supabase. O utilizador escolhe o país e as cadeias que pretende comparar; a função envia essa seleção e os artigos ao Gemini para produzir intervalos de preço indicativos. Não é necessário pedir acesso à localização nem consultar OpenStreetMap/Overpass.

O catálogo inicial inclui mercados da Europa, América do Sul, Estados Unidos e Canadá. Os países, moedas e supermercados são configuráveis através da migração `supabase/migrations/202611030001_international_supermarket_catalogue.sql`. A seleção do país e das cadeias fica guardada localmente no dispositivo nesta fase.

Para ativar a funcionalidade no projeto Supabase:

1. Executa a migração `202611030001_international_supermarket_catalogue.sql` no SQL Editor.
2. Confirma que o secret `GEMINI_API_KEY` está definido em **Project Settings → Edge Functions → Secrets**.
3. Publica a função: `supabase functions deploy listora-basket-estimate`.
4. Confirma que a função está disponível no mesmo projeto indicado por `VITE_SUPABASE_URL`.

A função utiliza as variáveis de ambiente internas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para consultar o catálogo. A chave de serviço nunca deve ser exposta no frontend. As estimativas não consultam preços atuais nem garantem poupanças; a disponibilidade das cadeias pode variar por região. A comparação está disponível gratuitamente para todos os utilizadores autenticados. A proteção contra abuso aplica-se apenas a pedidos excessivos num curto intervalo e não representa um limite comercial mensal.


## Migrações de estabilização e aplicação gratuita

Depois das migrações de inventário e de listas partilhadas já existentes, executa no SQL Editor do Supabase, por esta ordem:

1. `supabase/migrations/202611130001_move_purchased_item_to_inventory.sql` — permite transferir artigos comprados para Em casa numa única transação, removendo-os da lista de compras sem duplicar stock.
2. `supabase/migrations/202611130002_ai_rate_limits.sql` — cria proteção de frequência isolada por utilizador e funcionalidade para os pedidos de IA.

A Listora não utiliza subscrições, planos Premium, paywalls nem quotas comerciais. As funções de comparação, extração por fotografia/voz, leitura de faturas e sugestões de receitas estão disponíveis para todos os utilizadores autenticados (incluindo sessões anónimas). As Edge Functions validam a sessão e utilizam `GEMINI_API_KEY` no servidor; não coloques chaves Gemini nem `service_role` no frontend.

## Deploy

A aplicação pode ser distribuída como app Android através do APK gerado no GitHub Actions. Não é necessário publicar uma página web para criar listas ou partilhá-las: os familiares introduzem na app o código da lista. O build web continua disponível para desenvolvimento e testes, mas não é um requisito para a partilha. O URL Supabase e a chave publicável são dados de cliente e podem estar no bundle. **Nunca coloques uma chave `service_role` no frontend.**

## Segurança

Todas as funcionalidades estão disponíveis gratuitamente. Não existem planos pagos, subscrições nem bloqueios por subscrição. Os pedidos às APIs de IA mantêm proteção técnica contra abuso e frequência excessiva.


As tabelas não têm acesso direto concedido ao papel `anon`; a app usa funções PostgreSQL `SECURITY DEFINER` com `search_path` fixo e validação do código de partilha. O código de convite dá acesso de leitura e escrita à lista, pelo que deve ser partilhado apenas com pessoas de confiança. O código gerado tem 12 caracteres hexadecimais. As Edge Functions de IA validam a sessão e aplicam rate limiting independente por utilizador e funcionalidade (10 pedidos por minuto por funcionalidade). Este limite protege os serviços externos e não restringe a utilização mensal nem bloqueia funcionalidades por plano. Para utilização pública em escala, considera também convites revogáveis e associação das listas a contas.

## Estrutura

- `src/App.jsx`: interface e chamadas RPC.
- `src/lib/supabase.js`: cliente Supabase.
- `supabase/migrations/`: schema, funções RPC e permissões.

## Autenticação e contas Listora

A autenticação usa Supabase Auth e mantém o modo de convidado para permitir começar sem registo.

1. Executa primeiro as migrações existentes, incluindo o catálogo internacional, e depois `202611040001_user_accounts.sql`.
2. Em **Authentication → Sign In / Providers**, ativa **Anonymous Sign-Ins**, **Email** e **Google**. Não é necessário ativar Apple.
3. No provider Google, configura o Client ID e Client Secret OAuth e adiciona o URL de callback do Supabase às credenciais OAuth da Google.
4. Em **Authentication → URL Configuration**, define o Site URL e os Redirect URLs usados pela aplicação (produção e desenvolvimento).
5. Configura SMTP próprio em **Authentication → SMTP Settings** antes de produção, para confirmação de email e recuperação de password.
6. A tabela `user_profiles` guarda nome, país e idade opcional, com RLS limitada ao próprio utilizador.

A conversão de uma sessão anónima para email/password usa `auth.updateUser`, preservando o mesmo UUID do utilizador. A ligação Google usa `auth.linkIdentity`; confirma que o identity linking está permitido nas definições do projeto Supabase. O login normal usa email/password ou Google OAuth.

**Importante:** esta primeira fase estabelece a identidade e o perfil, mas as listas continuam a ser autorizadas pelo código de partilha existente e o identificador de membro continua associado ao dispositivo. A migração da propriedade das listas para contas e membros autenticados será feita numa fase posterior, com um fluxo explícito para associar listas antigas à conta, sem quebrar os convites atuais.
