# 💰 app Finanças - LHS Finanças

Aplicativo de controle financeiro pessoal e compartilhado desenvolvido com **React Native**, **Expo** e **Supabase**.

## 🚀 Funcionalidades
- **Autenticação Segura:** Login e cadastro gerenciados via Supabase Auth.
- **Banco de Dados em Nuvem:** Sincronização em tempo real de transações, contas e metas.
- **Conta Conjunta (Multi-tenant):** Sistema de parcerias que permite compartilhar contas específicas com outro usuário de forma granular.
- **Modo Escuro/Claro:** Interface adaptativa conforme a preferência do sistema ou usuário.
- **Segurança Biométrica:** Proteção de acesso via Digital/FaceID.

## 🛠️ Tecnologias Utilizadas
- **Frontend:** React Native (Expo Router)
- **Backend/DB:** Supabase (PostgreSQL)
- **Segurança:** Row Level Security (RLS) para isolamento de dados por usuário.

## 👥 Arquitetura de Compartilhamento
O projeto utiliza uma lógica de parcerias baseada em tabelas relacionais, permitindo que um usuário convide outro para visualizar e editar contas selecionadas, mantendo a privacidade dos dados individuais.

---
Desenvolvido por **Luis Palacio** e **Gabriel Henrique Alves** (Estudantes de Ciência da Computação na Braz Cubas)

