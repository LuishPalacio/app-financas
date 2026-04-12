import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAppTheme } from "./_layout";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const MODELO = "llama-3.3-70b-versatile";

interface Mensagem {
  id: string;
  role: "user" | "ia" | "sistema";
  texto: string;
}

interface RespostaIA {
  intent:
    | "create_transaction"
    | "create_account"
    | "delete_transaction"
    | "archive_account"
    | "query";
  status: "collecting_data" | "ready_for_confirmation" | "confirmed";
  data: Record<string, any>;
  missing_fields: string[];
  message: string;
}

// Prompt base — as contas reais do usuário são injetadas dinamicamente dentro do componente
const PROMPT_BASE = `Você é uma consultora financeira simples e direta.

REGRAS IMPORTANTES (siga sempre):
- Responda APENAS com um JSON válido. Nada de texto antes ou depois.
- Nunca use marcadores de código ou tags especiais.
- Pergunte apenas UM campo por vez, na ordem abaixo.
- Quando tiver TODOS os campos obrigatórios, mude status para "ready_for_confirmation", mostre resumo e pergunte se pode prosseguir.
- Se o usuário mandar mensagem fora do contexto enquanto você aguarda um campo, IGNORE e continue perguntando o campo que falta.

CAMPOS OBRIGATÓRIOS para create_transaction (colete nessa ordem):
1. tipo: "receita" ou "despesa"
2. value: valor numérico
3. description: descrição da transação
4. category: categoria. Sempre liste as opções ao perguntar.
   Receita: Salário, Empréstimo, Presente, Venda, Investimento, Outros
   Despesa: Alimentação, Transporte, Saúde, Lazer, Moradia, Educação, Outros
   Se o usuário digitar algo parecido, normalize. Se não bater, use "Outros".
5. conta_id: em qual conta lançar. Use a lista CONTAS_DISPONIVEIS abaixo. Mostre os nomes e peça para escolher. Salve o id numérico no campo conta_id.
6. date: data no formato DD/MM/YYYY. Converta internamente para YYYY-MM-DD. Se quiser hoje, use a data atual.

CAMPOS OBRIGATÓRIOS para create_account:
1. nome: nome da conta
2. saldo_inicial: saldo inicial numérico

Intents disponíveis:
- create_transaction: criar receita ou despesa
- create_account: criar conta
- delete_transaction: apagar transação
- archive_account: arquivar conta
- query: conversa normal

Exemplo coletando conta:
{"intent":"create_transaction","status":"collecting_data","data":{"tipo":"receita","value":500,"description":"Salário","category":"Salário"},"missing_fields":["conta_id"],"message":"Em qual conta deseja lançar? Opções: Nubank (1), Inter (2)."}

Exemplo pronto para confirmar:
{"intent":"create_transaction","status":"ready_for_confirmation","data":{"tipo":"receita","value":500,"description":"Salário","category":"Salário","conta_id":1,"date":"2025-01-15"},"missing_fields":[],"message":"Resumo:
Tipo: receita
Valor: R$ 500
Descrição: Salário
Categoria: Salário
Conta: Nubank
Data: 15/01/2025

Posso criar?"}

Responda SOMENTE com o JSON.`;

export default function ChatIA() {
  const { isDark, session } = useAppTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

  // FIX 2: refs para currentData, currentIntent e currentStatus
  // evitam stale closures dentro de funções async
  const currentDataRef = useRef<Record<string, any>>({});
  const currentIntentRef = useRef<RespostaIA["intent"] | null>(null);
  const currentStatusRef = useRef<RespostaIA["status"]>("collecting_data");

  // Contas do usuário carregadas do Supabase
  const [contasUsuario, setContasUsuario] = useState<
    { id: number; nome: string }[]
  >([]);

  // Prompt dinâmico com as contas reais do usuário injetadas
  const promptSistema =
    contasUsuario.length > 0
      ? PROMPT_BASE +
        `\n\nCONTAS_DISPONIVEIS: ${contasUsuario.map((c) => `${c.nome} (id: ${c.id})`).join(", ")}`
      : PROMPT_BASE +
        "\n\nCONTAS_DISPONIVEIS: nenhuma conta encontrada (oriente o usuário a criar uma conta primeiro).";

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    header: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333333" : "#DDDDDD",
    bolhaUser: "#2A9D8F",
    bolhaIA: isDark ? "#333333" : "#EAEAEA",
    textoBolhaIA: isDark ? "#FFFFFF" : "#1A1A1A",
    bolhaSistema: "#E9C46A",
  };

  // Carrega contas ativas do usuário para o chat poder perguntar qual usar
  const carregarContas = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("contas")
      .select("id, nome")
      .eq("user_id", session.user.id)
      .or("arquivado.eq.false,arquivado.is.null");
    if (data) setContasUsuario(data);
  };

  // FIX 3: guard de session antes de salvar
  const salvarMensagem = async (role: string, texto: string) => {
    if (!session?.user?.id) return;
    try {
      await supabase.from("chat_historico").insert({
        user_id: session.user.id,
        role,
        texto,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Erro ao salvar mensagem:", e);
    }
  };

  // FIX 4: verifica histórico local antes de mostrar boas-vindas
  const inicializarChat = async () => {
    const salvo = await AsyncStorage.getItem("@historico_chat");
    if (salvo) {
      try {
        const parsed: Mensagem[] = JSON.parse(salvo);
        if (parsed.length > 0) {
          setMensagens(parsed);
          return;
        }
      } catch (_) {}
    }

    const boasVindas: Mensagem = {
      id: "1",
      role: "ia",
      texto: "Olá! Sou sua consultora financeira. Como posso ajudar hoje?",
    };
    setMensagens([boasVindas]);
    await salvarMensagem("ia", boasVindas.texto);
  };

  useEffect(() => {
    inicializarChat();
    carregarContas();
  }, []);

  useEffect(() => {
    if (mensagens.length > 0) {
      AsyncStorage.setItem("@historico_chat", JSON.stringify(mensagens));
    }
  }, [mensagens]);

  // Converte DD/MM/YYYY → YYYY-MM-DD; retorna o valor original se já estiver correto ou for inválido
  const converterData = (data: string | undefined): string => {
    if (!data) return new Date().toISOString().split("T")[0];
    const match = data.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return data; // já está em YYYY-MM-DD ou outro formato
  };

  const criarTransacao = async (data: Record<string, any>) => {
    // Usa conta_id informado pelo usuário via chat; fallback para primeira conta ativa
    let contaId = data.conta_id ? Number(data.conta_id) : null;

    if (!contaId) {
      const { data: contas } = await supabase
        .from("contas")
        .select("id")
        .eq("user_id", session?.user?.id)
        .or("arquivado.eq.false,arquivado.is.null")
        .limit(1);
      contaId = contas?.[0]?.id ?? null;
    }

    console.log("🏦 conta_id usado:", contaId);

    if (!contaId)
      return "Nenhuma conta ativa encontrada. Crie uma conta primeiro.";

    const { error } = await supabase.from("transacoes").insert({
      tipo: data.tipo,
      valor: Number(data.value),
      descricao: `[${data.category || "Outros"}] ${data.description}`,
      status: "paga",
      data_vencimento: converterData(data.date),
      conta_id: contaId,
      user_id: session?.user?.id,
    });

    if (error) return `Erro ao criar: ${error.message}`;
    atualizarSaldo();
    return `✅ ${data.tipo === "receita" ? "Receita" : "Despesa"} de R$ ${Number(data.value).toFixed(2)} criada com sucesso!`;
  };

  const criarConta = async (data: Record<string, any>) => {
    const { error } = await supabase.from("contas").insert({
      user_id: session?.user?.id,
      nome: data.nome || "Nova Conta",
      saldo_inicial: Number(data.saldo_inicial || 0),
      arquivado: false,
    });

    if (error) return `Erro ao criar conta: ${error.message}`;
    atualizarSaldo();
    return `✅ Conta "${data.nome}" criada com sucesso!`;
  };

  const deletarTransacao = async (data: Record<string, any>) => {
    let query = supabase
      .from("transacoes")
      .select("id")
      .eq("user_id", session?.user?.id)
      .limit(3);

    if (data.description)
      query = query.ilike("descricao", `%${data.description}%`);
    if (data.date) query = query.eq("data_vencimento", data.date);

    const { data: found } = await query;

    if (!found?.length) return "Nenhuma transação encontrada com esses dados.";

    const { error } = await supabase
      .from("transacoes")
      .delete()
      .eq("id", found[0].id);
    if (error) return `Erro ao apagar: ${error.message}`;

    atualizarSaldo();
    return `✅ Transação apagada com sucesso!`;
  };

  const arquivarConta = async (data: Record<string, any>) => {
    let query = supabase
      .from("contas")
      .select("id")
      .eq("user_id", session?.user?.id)
      .limit(1);

    if (data.nome) query = query.ilike("nome", `%${data.nome}%`);

    const { data: found } = await query;

    if (!found?.length) return "Nenhuma conta encontrada.";

    const { error } = await supabase
      .from("contas")
      .update({ arquivado: true })
      .eq("id", found[0].id);

    if (error) return `Erro ao arquivar: ${error.message}`;
    atualizarSaldo();
    return `✅ Conta "${data.nome}" arquivada com sucesso!`;
  };

  const enviarMensagem = async () => {
    if (!input.trim() || carregando) return;

    const textoUsuario = input.trim();
    setInput("");

    const novaMsg: Mensagem = {
      id: Date.now().toString(),
      role: "user",
      texto: textoUsuario,
    };

    const novasMensagens = [...mensagens, novaMsg];
    setMensagens(novasMensagens);
    await salvarMensagem("user", textoUsuario);

    setCarregando(true);

    try {
      // Valida chave antes de chamar a API
      if (!GROQ_API_KEY) {
        throw new Error(
          "GROQ_API_KEY não encontrada. Verifique o arquivo .env",
        );
      }

      const historicoParaAPI = novasMensagens
        .filter((m) => m.role !== "sistema")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.texto,
        }));

      console.log(
        "📡 Chamando Groq API... chave:",
        GROQ_API_KEY ? "✅ presente" : "❌ ausente",
      );

      const resAPI = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: MODELO,
            messages: [
              { role: "system", content: promptSistema },
              ...historicoParaAPI,
            ],
            temperature: 0.1,
            max_tokens: 900,
          }),
        },
      );

      console.log("📬 Status da resposta Groq:", resAPI.status);

      const dados = await resAPI.json();
      console.log("📦 Dados recebidos:", JSON.stringify(dados).slice(0, 200));

      if (!resAPI.ok)
        throw new Error(dados.error?.message || `Erro HTTP ${resAPI.status}`);

      let conteudo = dados.choices[0]?.message?.content || "";
      console.log("🔍 Resposta bruta da Groq:", conteudo);

      conteudo = conteudo
        .replace(/```json|```/g, "")
        .replace(/<[^>]+>/g, "")
        .trim();

      let respostaIA: RespostaIA;
      try {
        const jsonMatch = conteudo.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : conteudo;
        respostaIA = JSON.parse(jsonStr);
      } catch (e) {
        console.error("❌ Erro no parse do JSON:", conteudo);
        respostaIA = {
          intent: "query",
          status: "collecting_data",
          data: {},
          missing_fields: [],
          message: "Não entendi direito. Pode repetir de forma mais clara?",
        };
      }

      // Se já há um intent em andamento (collecting_data), trava ele —
      // impede que mensagens ambíguas do usuário troquem o intent no meio do fluxo
      const intentEmAndamento =
        currentIntentRef.current !== null &&
        currentStatusRef.current === "collecting_data";

      const mergedData = { ...currentDataRef.current, ...respostaIA.data };
      currentDataRef.current = mergedData;

      // Só atualiza o intent se não houver um em andamento
      if (!intentEmAndamento) {
        currentIntentRef.current =
          respostaIA.intent ?? currentIntentRef.current;
      }
      currentStatusRef.current = respostaIA.status ?? currentStatusRef.current;

      if (respostaIA.message) {
        const textoLimpo = respostaIA.message.replace(/\\n/g, "\n");
        const msgIA: Mensagem = {
          id: `${Date.now()}-ia`,
          role: "ia",
          texto: textoLimpo,
        };
        setMensagens((prev) => [...prev, msgIA]);
        await salvarMensagem("ia", textoLimpo);
      }

      const CONFIRMACOES = [
        "sim",
        "pode",
        "confirma",
        "confirmar",
        "ok",
        "yes",
        "pronto",
        "vai",
        "deletar",
        "arquivar",
      ];
      const usuarioConfirmou = CONFIRMACOES.some((p) =>
        textoUsuario.toLowerCase().includes(p),
      );

      // FIX 7: usa currentStatusRef (valor atualizado) em vez do estado antigo
      const deveExecutar =
        respostaIA.status === "confirmed" ||
        (respostaIA.status === "ready_for_confirmation" && usuarioConfirmou) ||
        (currentStatusRef.current === "ready_for_confirmation" &&
          usuarioConfirmou);

      if (deveExecutar) {
        let resultado = "Ação realizada.";

        // FIX 8: usa mergedData (já combinado acima) — sem depender de closure
        switch (currentIntentRef.current) {
          case "create_transaction":
            resultado = await criarTransacao(mergedData);
            break;
          case "create_account":
            resultado = await criarConta(mergedData);
            break;
          case "delete_transaction":
            resultado = await deletarTransacao(mergedData);
            break;
          case "archive_account":
            resultado = await arquivarConta(mergedData);
            break;
          default:
            resultado = "Ação concluída.";
        }

        const msgSucesso: Mensagem = {
          id: `${Date.now()}-sys`,
          role: "sistema",
          texto: resultado,
        };
        setMensagens((prev) => [...prev, msgSucesso]);
        await salvarMensagem("sistema", resultado);

        // reseta refs após execução
        currentDataRef.current = {};
        currentIntentRef.current = null;
        currentStatusRef.current = "collecting_data";
      }
    } catch (error: any) {
      console.error("Erro geral:", error);
      const msgErro = error?.message || "Erro desconhecido";
      setMensagens((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ia",
          // Mostra o erro real na tela para facilitar o debug no celular
          texto: `⚠️ Erro: ${msgErro}`,
        },
      ]);
    } finally {
      setCarregando(false);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };

  const limparChat = async () => {
    await AsyncStorage.removeItem("@historico_chat");
    if (session?.user?.id) {
      await supabase
        .from("chat_historico")
        .delete()
        .eq("user_id", session.user.id);
    }
    setMensagens([
      { id: "1", role: "ia", texto: "Chat limpo! Como posso ajudar agora?" },
    ]);
    currentDataRef.current = {};
    currentIntentRef.current = null;
    currentStatusRef.current = "collecting_data";
    carregarContas();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: Cores.header, borderBottomColor: Cores.borda },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 10 }}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={Cores.textoPrincipal}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Cores.textoPrincipal }]}>
            ✨ Consultora IA
          </Text>
          <TouchableOpacity onPress={limparChat} style={{ padding: 10 }}>
            <MaterialIcons
              name="delete-outline"
              size={24}
              color={Cores.textoSecundario}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.chatArea}
          contentContainerStyle={{ padding: 15 }}
          ref={scrollViewRef}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {mensagens.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bolha,
                msg.role === "user"
                  ? styles.bolhaDireita
                  : styles.bolhaEsquerda,
                {
                  backgroundColor:
                    msg.role === "user"
                      ? Cores.bolhaUser
                      : msg.role === "sistema"
                        ? Cores.bolhaSistema
                        : Cores.bolhaIA,
                },
              ]}
            >
              <Text
                style={{
                  color: msg.role === "user" ? "#FFF" : Cores.textoBolhaIA,
                  fontSize: 16,
                }}
              >
                {msg.texto}
              </Text>
            </View>
          ))}

          {carregando && (
            <View
              style={[
                styles.bolha,
                styles.bolhaEsquerda,
                { backgroundColor: Cores.bolhaIA },
              ]}
            >
              <ActivityIndicator size="small" color="#2A9D8F" />
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.inputArea,
            { backgroundColor: Cores.header, borderTopColor: Cores.borda },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: Cores.fundo,
                color: Cores.textoPrincipal,
                borderColor: Cores.borda,
              },
            ]}
            placeholder="Digite sua mensagem..."
            placeholderTextColor={Cores.textoSecundario}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={enviarMensagem}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.btnEnviar,
              { backgroundColor: input.trim() ? "#2A9D8F" : "#555" },
            ]}
            onPress={enviarMensagem}
            disabled={!input.trim() || carregando}
          >
            <MaterialIcons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  chatArea: { flex: 1 },
  bolha: { maxWidth: "85%", padding: 12, borderRadius: 16, marginBottom: 15 },
  bolhaEsquerda: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bolhaDireita: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
  },
  btnEnviar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
function atualizarSaldo() {
  throw new Error("Function not implemented.");
}
