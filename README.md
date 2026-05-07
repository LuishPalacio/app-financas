# 💰 FinFlow Finanças

> App de controle financeiro pessoal e compartilhado com **assistente IA** que entende comandos em linguagem natural.

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat&logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=flat&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase&logoColor=white)

---

## ✨ Funcionalidades

- 🔐 **Autenticação segura** com Supabase Auth + biometria (Face ID / Digital)
- 💳 **Gestão completa de transações** — receitas, despesas, categorias e contas
- 🎯 **Caixinhas de metas** para organizar economias por objetivo
- 🤝 **Conta conjunta multi-tenant** — compartilhe contas específicas com outra pessoa, mantendo o restante dos dados privados
- 🤖 **Assistente IA com Llama 3.3 70B** que entende linguagem natural (mais detalhes abaixo)
- 📊 **Relatórios e ranking** de gastos por categoria
- 🌙 **Tema claro/escuro** adaptativo ao sistema
- 🔔 **Notificações locais** para lembretes financeiros
- 📱 **Cache local com SQLite** para uso offline

---

## 🤖 Sobre o Assistente IA

O assistente do FinFlow não é um chatbot tradicional — é um **agente estruturado** que traduz linguagem natural em ações no banco de dados.

**Como funciona:**

1. Usuário fala normalmente: *"gastei 80 reais no mercado ontem"*
2. A IA (Llama 3.3 70B via Groq) retorna um **JSON estruturado** com `intent`, `data`, `missing_fields` e `status`
3. Se faltar algum dado, o agente coleta via conversa
4. Antes de executar, o app pede **confirmação** do usuário
5. Após confirmar, a ação é executada no Supabase

**Intents suportadas (17+):** criar transação, criar/editar/excluir conta, criar/mover/arquivar caixinha, confirmar pendências, analisar finanças, fazer projeções, definir metas de economia, e mais.

Essa arquitetura garante que o LLM nunca executa direto — sempre passa por validação e confirmação humana.

---

## 🏗️ Arquitetura

### Multi-tenant com Row Level Security

O sistema de conta conjunta usa **políticas RLS do PostgreSQL** para garantir o isolamento de dados na camada do banco:

- Cada usuário tem seu próprio escopo de dados
- O compartilhamento é granular: o usuário escolhe **quais contas específicas** compartilhar com qual parceiro
- As políticas RLS garantem que mesmo via API direta, ninguém acessa dados que não deveria — segurança não depende só do código do app

### IA como camada de comando

A camada de IA é desacoplada da execução. O fluxo é sempre:

```
Linguagem natural → JSON estruturado → Validação → Confirmação → Banco
```

Isso permite trocar o modelo (ou rodar local) sem mudar a lógica de negócio.

---

## 🛠️ Stack Técnica

**Frontend**
- React Native 0.81
- Expo SDK 54 + Expo Router 6 (file-based routing)
- TypeScript 5.9
- React Native Reanimated 4

**Backend & Dados**
- Supabase (PostgreSQL + Auth + Realtime)
- Row Level Security (RLS)
- AsyncStorage + Expo SQLite (cache local)

**IA**
- Groq API
- Modelo: `llama-3.3-70b-versatile`

**Mobile-specific**
- expo-local-authentication (biometria)
- expo-notifications
- expo-haptics
- expo-image

---

## 🚀 Como rodar localmente

```bash
# Clone o repositório
git clone https://github.com/SEU-USUARIO/app-financas.git
cd app-financas

# Instale as dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
```

Edite o `.env` com suas chaves:

```
EXPO_PUBLIC_SUPABASE_URL=sua-url-supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
EXPO_PUBLIC_GROQ_API_KEY=sua-chave-groq
```

```bash
# Inicie o projeto
npx expo start
```

Escaneie o QR code com o app **Expo Go** ou rode em emulador iOS/Android.

---

## 📝 Decisões técnicas e aprendizados

- **Por que Supabase + RLS:** queria segurança real (na camada do banco) e não só validações no app. RLS força o isolamento mesmo em chamadas diretas à API.
- **Por que IA estruturada (JSON) em vez de chat livre:** garantir confiabilidade. Um LLM solto pode gerar texto bonito que executa coisas erradas. Forçando JSON com validação, o usuário sempre confirma antes da ação.
- **Por que Expo Router:** a navegação por arquivos deixa a estrutura do projeto mais previsível e facilita manutenção.
- **Por que Groq + Llama 70B:** latência baixa (importante em chat) e bom desempenho em tarefas estruturadas de extração.

---

## 🗺️ Roadmap

- [ ] Importação de extratos via OCR
- [ ] Dashboard web complementar
- [ ] Notificações inteligentes baseadas em padrões
- [ ] Modo offline-first completo
- [ ] Compartilhamento de relatórios em PDF

---

## 👤 Autor

**Luis Henrique Palacio**

Projeto desenvolvido como parte da minha transição para desenvolvimento mobile. Aberto a feedback, sugestões e oportunidades.

- 💼 LinkedIn: *www.linkedin.com/in/luishpalacio*
- 📧 Email: *luispalacio1617@gmail.com*

---

⭐ Se o projeto te ajudou ou despertou interesse, deixa uma estrela!
