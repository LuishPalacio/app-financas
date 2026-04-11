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
  intent: "create_transaction" | "create_account" | "query";
  status: "collecting_data" | "ready_for_confirmation" | "confirmed";
  data: Record<string, any>;
  missing_fields: string[];
  message: string;
}

export default function ChatIA() {
  const { isDark, session } = useAppTheme();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

  const [currentData, setCurrentData] = useState<Record<string, any>>({});
  const [currentIntent, setCurrentIntent] = useState<
    RespostaIA["intent"] | null
  >(null);
  const [currentStatus, setCurrentStatus] =
    useState<RespostaIA["status"]>("collecting_data");

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
      contas?.reduce((acc, c) => acc + (c.saldo_inicial || 0), 0) ?? 0;
    const receitas =
      trans
        ?.filter((t) => t.tipo === "receita" && t.status === "paga")
        .reduce((acc, t) => acc + t.valor, 0) ?? 0;
    const despesas =
      trans
        ?.filter((t) => t.tipo === "despesa" && t.status === "paga")
        .reduce((acc, t) => acc + t.valor, 0) ?? 0;

    console.log("Saldo atualizado:", inicial + receitas - despesas);
  };

  const salvarMensagem = async (role: string, texto: string) => {
    try {
      await supabase.from("chat_historico").insert({
        user_id: session?.user?.id,
        role,
        texto,
        created_at: new Date().toISOString(),
      });
    } catch {}
  };

  const inicializarChat = async () => {
    const boasVindas: Mensagem = {
      id: "1",
      role: "ia",
      texto: "Olá! Sou sua consultora financeira. Como posso ajudar?",
    };
    setMensagens([boasVindas]);
    await salvarMensagem("ia", boasVindas.texto);
  };

  useEffect(() => {
    inicializarChat();
  }, []);

  useEffect(() => {
    if (mensagens.length > 0) {
      AsyncStorage.setItem("@historico_chat", JSON.stringify(mensagens));
    }
  }, [mensagens]);

  const promptSistema = `Você é uma consultora financeira simples e direta.

REGRAS IMPORTANTES:
- Se o usuário disser "criar conta", "nova conta", "crie uma conta" → intent: "create_account"
- Caso contrário → intent: "create_transaction"
- Pergunte APENAS UM campo por vez (nunca liste vários).
- Quando todos os campos estiverem coletados, mostre resumo + "Posso criar?"
- Responda SEMPRE apenas com JSON válido.

Exemplo para transação:
{
  "intent": "create_transaction",
  "status": "collecting_data",
  "data": {"tipo": "receita", "value": 1000},
  "missing_fields": ["description"],
  "message": "Qual a descrição?"
}

Quando pronto:
{
  "intent": "create_transaction",
  "status": "ready_for_confirmation",
  "data": {...},
  "missing_fields": [],
  "message": "Tipo: receita\\nValor: 1000\\nDescrição: ...\\nCategoria: ...\\nConta: ...\\nData: ...\\n\\nPosso criar?"
}

Responda apenas com o JSON.`;

  const criarTransacao = async (data: Record<string, any>) => {
    const { data: contas } = await supabase
      .from("contas")
      .select("id")
      .eq("user_id", session?.user?.id)
      .limit(1);

    if (!contas?.length) return "Nenhuma conta encontrada.";

    const { error } = await supabase.from("transacoes").insert({
      tipo: data.tipo,
      valor: Number(data.value),
      descricao: `[${data.category || "Outros"}] ${data.description}`,
      status: "paga",
      data_vencimento: data.date || new Date().toISOString().split("T")[0],
      conta_id: contas[0].id,
      user_id: session?.user?.id,
    });

    if (error) return `Erro ao criar: ${error.message}`;

    await atualizarSaldo();
    return `✅ ${data.tipo === "receita" ? "Receita" : "Despesa"} de R$ ${Number(data.value).toFixed(2)} criada com sucesso.`;
  };

  const criarConta = async (data: Record<string, any>) => {
    const { error } = await supabase.from("contas").insert({
      user_id: session?.user?.id,
      nome: data.nome || data.description,
      saldo_inicial: Number(data.saldo_inicial || 0),
    });

    if (error) return `Erro ao criar conta: ${error.message}`;

    await atualizarSaldo();
    return `✅ Conta "${data.nome || data.description}" criada com sucesso!`;
  };

  const enviarMensagem = async () => {
    if (!input.trim() || carregando) return;

    const textoUsuario = input.trim();
    setInput("");

    // Adiciona mensagem do usuário imediatamente
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
      const historicoParaAPI = novasMensagens
        .filter((m) => m.role !== "sistema")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.texto,
        }));

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
            max_tokens: 700,
            response_format: { type: "json_object" },
          }),
        },
      );

      const dados = await resAPI.json();
      if (!resAPI.ok) throw new Error(dados.error?.message || "Erro na API");

      let conteudo = dados.choices[0]?.message?.content || "";
      conteudo = conteudo.replace(/```json|```/g, "").trim();

      const jsonMatch = conteudo.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : conteudo;

      let respostaIA: RespostaIA;
      try {
        respostaIA = JSON.parse(jsonStr);
      } catch (e) {
        console.error("JSON parse falhou:", conteudo);
        respostaIA = {
          intent: "query",
          status: "collecting_data",
          data: {},
          missing_fields: [],
          message: "Não entendi. Pode repetir?",
        };
      }

      setCurrentIntent(respostaIA.intent);
      setCurrentData((prev) => ({ ...prev, ...respostaIA.data }));
      setCurrentStatus(respostaIA.status);

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

      // Confirmação
      const confirmacoes = [
        "sim",
        "pode",
        "confirma",
        "confirmar",
        "ok",
        "yes",
        "pronto",
      ];
      const usuarioConfirmou = confirmacoes.some((p) =>
        textoUsuario.toLowerCase().includes(p),
      );

      if (
        respostaIA.status === "confirmed" ||
        (respostaIA.status === "ready_for_confirmation" && usuarioConfirmou)
      ) {
        let resultado = "Ação realizada.";

        if (
          respostaIA.intent === "create_transaction" ||
          currentIntent === "create_transaction"
        ) {
          resultado = await criarTransacao(respostaIA.data || currentData);
        } else if (
          respostaIA.intent === "create_account" ||
          currentIntent === "create_account"
        ) {
          resultado = await criarConta(respostaIA.data || currentData);
        }

        const msgSucesso: Mensagem = {
          id: `${Date.now()}-sys`,
          role: "sistema",
          texto: resultado,
        };
        setMensagens((prev) => [...prev, msgSucesso]);
        await salvarMensagem("sistema", resultado);

        // Reset
        setCurrentData({});
        setCurrentIntent(null);
        setCurrentStatus("collecting_data");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      setMensagens((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ia",
          texto: "Ocorreu um erro. Tente novamente.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const limparChat = async () => {
    await AsyncStorage.removeItem("@historico_chat");
    await supabase
      .from("chat_historico")
      .delete()
      .eq("user_id", session?.user?.id);
    setMensagens([
      { id: "1", role: "ia", texto: "Memória limpa. Como posso ajudar?" },
    ]);
    setCurrentData({});
    setCurrentIntent(null);
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
            placeholder="Responda aqui..."
            placeholderTextColor={Cores.textoSecundario}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={enviarMensagem}
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
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
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
