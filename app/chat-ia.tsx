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

interface Mensagem {
  id: string;
  role: "user" | "ia" | "sistema";
  texto: string;
}

export default function ChatIA() {
  const { isDark, session } = useAppTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [saldoReal, setSaldoReal] = useState(0);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

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

  const atualizarSaldo = async () => {
    if (!session?.user?.id) return;
    const { data: trans } = await supabase
      .from("transacoes")
      .select("valor, tipo, status")
      .eq("user_id", session.user.id);
    const { data: contas } = await supabase
      .from("contas")
      .select("saldo_inicial")
      .eq("user_id", session.user.id);

    const inicial =
      contas?.reduce((acc, curr) => acc + (curr.saldo_inicial || 0), 0) ?? 0;
    const receitas =
      trans
        ?.filter((t) => t.tipo === "receita" && t.status === "paga")
        .reduce((acc, curr) => acc + curr.valor, 0) ?? 0;
    const despesas =
      trans
        ?.filter((t) => t.tipo === "despesa" && t.status === "paga")
        .reduce((acc, curr) => acc + curr.valor, 0) ?? 0;

    setSaldoReal(inicial + receitas - despesas);
  };

  const inicializarChat = async () => {
    if (!session?.user?.id) return;
    const historicoSalvo = await AsyncStorage.getItem("@historico_chat");
    if (historicoSalvo) {
      setMensagens(JSON.parse(historicoSalvo));
    } else {
      setMensagens([
        {
          id: "1",
          role: "ia",
          texto:
            "Olá! Sou sua consultora financeira do LHS Finanças. Posso registrar transações, pesquisar seus gastos ou te dar dicas para economizar. Como posso te ajudar hoje?",
        },
      ]);
    }
    await atualizarSaldo();
    setNomeUsuario(session.user.user_metadata?.nome_usuario ?? "");
  };

  useEffect(() => {
    inicializarChat();
  }, []);

  useEffect(() => {
    if (mensagens.length > 0)
      AsyncStorage.setItem("@historico_chat", JSON.stringify(mensagens));
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!input.trim() || carregando) return;

    const msgUsuario = input;
    setInput("");
    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { id: Date.now().toString(), role: "user", texto: msgUsuario },
    ];
    setMensagens(novasMensagens);
    setCarregando(true);

    try {
      // 🎭 ENGENHARIA DE PERSONA: Dando vida e educação à IA
      const promptSistema = `Você é a assistente financeira premium do app LHS Finanças. Seu objetivo é cuidar da vida financeira do usuário de forma extremamente educada, empática e humana, agindo como uma consultora pessoal e amiga.
      
      DADOS DO USUÁRIO:
      - Nome: ${nomeUsuario || "Luis"}
      - Saldo atual: R$ ${saldoReal.toFixed(2)}
      
      REGRAS DE PERSONALIDADE (MUITO IMPORTANTE):
      1. Seja muito gentil, calorosa e use um tom de voz acolhedor. Sempre chame o usuário pelo nome.
      2. Use emojis com naturalidade para expressar emoções (ex: 🎉 para receitas, 💸 ou 🤔 para despesas).
      3. Comemore quando o usuário registrar ganhos (salário, freelas) e seja compreensiva e dê apoio se ele relatar um gasto alto ou não planejado.
      4. Quando o usuário pedir dicas de economia ou apenas conversar, dê respostas ricas, organizadas e encorajadoras.
      
      FERRAMENTAS: Você tem acesso a 'criar_transacao', 'pesquisar_gastos' e 'desfazer_ultima'. Use-as silenciosamente quando precisar agir nos dados.`;

      const historicoParaAPI = novasMensagens.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content:
          m.role === "sistema"
            ? `[AÇÃO JÁ EXECUTADA NO BANCO DE DADOS: ${m.texto}]`
            : m.texto,
      }));

      // 🛠️ O CINTO DE FERRAMENTAS COMPLETO
      const ferramentas = [
        {
          type: "function",
          function: {
            name: "criar_transacao",
            description: "Registra dinheiro entrando ou saindo.",
            parameters: {
              type: "object",
              properties: {
                tipo: { type: "string", enum: ["receita", "despesa"] },
                valor: { type: "number" },
                descricao: { type: "string" },
                categoria: {
                  type: "string",
                  enum: [
                    "Alimentação",
                    "Moradia",
                    "Transporte",
                    "Lazer",
                    "Saúde",
                    "Salário",
                    "Outros",
                  ],
                  description: "Adivinhe a categoria baseada na descrição.",
                },
              },
              required: ["tipo", "valor", "descricao", "categoria"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "pesquisar_gastos",
            description:
              "Pesquisa o histórico de transações por uma palavra-chave para saber quanto foi gasto.",
            parameters: {
              type: "object",
              properties: {
                termo: {
                  type: "string",
                  description:
                    "O nome do lugar, marca ou conta para pesquisar (ex: 'Ifood', 'Luz', 'Uber').",
                },
              },
              required: ["termo"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "desfazer_ultima",
            description:
              "Apaga a última transação cadastrada no banco de dados se o usuário disser que errou ou pedir para cancelar a última.",
            parameters: { type: "object", properties: {} },
          },
        },
      ];

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: promptSistema },
              ...historicoParaAPI,
            ],
            tools: ferramentas,
            tool_choice: "auto",
            temperature: 0.3, // Aumentei levemente para ela ser mais criativa nas respostas
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Erro na API");

      const mensagemRetorno = data.choices[0].message;

      if (mensagemRetorno.tool_calls) {
        for (const toolCall of mensagemRetorno.tool_calls) {
          const args = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {};

          // PODER 1: CRIAR COM CATEGORIA
          if (toolCall.function.name === "criar_transacao") {
            const { data: listContas } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", session?.user?.id)
              .limit(1);
            if (listContas && listContas.length > 0) {
              await supabase.from("transacoes").insert([
                {
                  tipo: args.tipo,
                  valor: args.valor,
                  descricao: `[${args.categoria}] ${args.descricao}`,
                  status: "paga",
                  data_vencimento: new Date().toISOString().split("T")[0],
                  conta_id: listContas[0].id,
                  user_id: session?.user?.id,
                },
              ]);
              setMensagens((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "sistema",
                  texto: `✅ Prontinho! Anotei R$ ${args.valor.toFixed(2)} em ${args.categoria}. Seu saldo já está atualizado!`,
                },
              ]);
            }
          }

          // PODER 2: PESQUISAR E SOMAR
          else if (toolCall.function.name === "pesquisar_gastos") {
            let query = supabase
              .from("transacoes")
              .select("valor, tipo, descricao")
              .eq("user_id", session?.user?.id);

            if (args.termo) {
              query = query.ilike("descricao", `%${args.termo}%`);
            }

            const { data: resultados } = await query;

            const totalGastos =
              resultados
                ?.filter((r) => r.tipo === "despesa")
                .reduce((acc, curr) => acc + curr.valor, 0) ?? 0;
            const totalReceitas =
              resultados
                ?.filter((r) => r.tipo === "receita")
                .reduce((acc, curr) => acc + curr.valor, 0) ?? 0;
            const qtd = resultados?.length ?? 0;

            let textoResposta = "";
            if (args.termo) {
              textoResposta = `🔍 Dei uma olhada aqui e encontrei ${qtd} registro(s) de "${args.termo}". O total gasto foi de R$ ${totalGastos.toFixed(2)}.`;
            } else {
              textoResposta = `📊 Aqui está o seu resumo: Você recebeu R$ ${totalReceitas.toFixed(2)} e gastou R$ ${totalGastos.toFixed(2)}.`;
            }

            setMensagens((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: "sistema",
                texto: textoResposta,
              },
            ]);
          }

          // PODER 3: BOTÃO DE PÂNICO
          else if (toolCall.function.name === "desfazer_ultima") {
            const { data: ultimas } = await supabase
              .from("transacoes")
              .select("id, descricao, valor")
              .eq("user_id", session?.user?.id)
              .order("id", { ascending: false })
              .limit(1);

            if (ultimas && ultimas.length > 0) {
              await supabase
                .from("transacoes")
                .delete()
                .eq("id", ultimas[0].id);
              setMensagens((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "sistema",
                  texto: `🗑️ Sem problemas! Acabei de apagar a transação "${ultimas[0].descricao}" de R$ ${ultimas[0].valor}.`,
                },
              ]);
            } else {
              setMensagens((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "sistema",
                  texto: `⚠️ Dei uma olhada, mas não encontrei nenhuma transação para apagar, viu?`,
                },
              ]);
            }
          }
        }
        await atualizarSaldo();
      } else if (mensagemRetorno.content) {
        setMensagens((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "ia",
            texto: mensagemRetorno.content,
          },
        ]);
      }
    } catch (error: any) {
      console.log("Erro completo:", error);
      setMensagens((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ia",
          texto: `Erro no Agente: ${error.message}`,
        },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const limparChat = async () => {
    await AsyncStorage.removeItem("@historico_chat");
    setMensagens([
      { id: "1", role: "ia", texto: "Memória limpa! Como posso ajudar agora?" },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 35}
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
                  color:
                    msg.role === "user" || msg.role === "sistema"
                      ? msg.role === "sistema"
                        ? "#1A1A1A"
                        : "#FFF"
                      : Cores.textoBolhaIA,
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
            placeholder="Ex: Gastei 300 reais, tô me sentindo culpado..."
            placeholderTextColor={Cores.textoSecundario}
            value={input}
            onChangeText={setInput}
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
    height: 45,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  btnEnviar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
