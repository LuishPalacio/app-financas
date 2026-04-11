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

// ✅ FIX 1: Chave de API movida para variável de ambiente.
// No arquivo .env na raiz do projeto, adicione:
//   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
// Nunca coloque a chave diretamente no código.
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

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
  // ✅ FIX 6: Removido o fallback fixo "Luis". Usa string vazia como padrão genérico.
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

  // ✅ FIX 2: Função separada apenas para atualizar o saldo.
  // Não toca nas mensagens, eliminando a race condition.
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

  // Inicializa o chat: carrega histórico + saldo + nome do usuário.
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
          texto: "Olá! Sou seu Agente IA. Vamos organizar suas finanças?",
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
    if (mensagens.length > 0) {
      AsyncStorage.setItem("@historico_chat", JSON.stringify(mensagens));
    }
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!input.trim()) return;

    const msgUsuario = input;
    setInput("");

    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { id: Date.now().toString(), role: "user", texto: msgUsuario },
    ];
    setMensagens(novasMensagens);
    setCarregando(true);

    try {
      const promptSistema = `Você é o Administrador do app LHS Finanças.
Saldo Real: R$ ${saldoReal.toFixed(2)}.
REGRAS DE NÚMEROS: O usuário usa "," para decimais (ex: 10,50).
Se for registrar algo, use SEMPRE: [CRIAR_TRANSACAO] | tipo | valor | desc.
No campo valor, use SEMPRE PONTO (.) para o sistema entender, nunca vírgula.`;

      // ✅ FIX 3: Histórico completo enviado ao GPT.
      // O modelo agora recebe todas as mensagens anteriores, mantendo o contexto da conversa.
      const historicoParaAPI = novasMensagens
        .filter((m) => m.role === "user" || m.role === "ia")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.texto,
        }));

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: promptSistema },
              ...historicoParaAPI,
            ],
            temperature: 0.3,
          }),
        },
      );

      const data = await response.json();
      const respostaIA = data.choices[0].message.content.trim();

      if (respostaIA.includes("[CRIAR_TRANSACAO]")) {
        const partes = respostaIA.split("|").map((p: string) => p.trim());
        const tipo = partes[1].toLowerCase().includes("receita")
          ? "receita"
          : "despesa";

        // ✅ FIX 4: Regex /,/g substitui TODAS as vírgulas, não só a primeira.
        const valorTratado = partes[2].replace(/,/g, ".");
        const valor = parseFloat(valorTratado);
        const descricao = partes[3] || "Registro via IA";

        const { data: listContas } = await supabase
          .from("contas")
          .select("id")
          .eq("user_id", session?.user?.id)
          .limit(1);

        if (listContas && listContas.length > 0) {
          await supabase.from("transacoes").insert([
            {
              tipo,
              valor,
              descricao: `IA: ${descricao}`,
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
              texto: `✅ Salvo! R$ ${valor.toFixed(2).replace(".", ",")} registrado.`,
            },
          ]);

          // ✅ FIX 2 (continuação): Chama só atualizarSaldo(), sem mexer nas mensagens.
          await atualizarSaldo();
        }
      } else {
        setMensagens((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "ia", texto: respostaIA },
        ]);
      }
    } catch (error) {
      // ✅ FIX 5: id único no erro para evitar chaves React duplicadas.
      setMensagens((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ia",
          texto: "Erro na conexão GPT-4o!",
        },
      ]);
    } finally {
      setCarregando(false);
    }
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
            ✨ Administrador IA
          </Text>
          <View style={{ width: 44 }} />
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
                    msg.role === "user"
                      ? "#FFF"
                      : msg.role === "sistema"
                        ? "#1A1A1A"
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
            placeholder="Ex: Recebi 50,25 hoje"
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
  // ✅ FIX 6: Removido "bolhaRight" duplicado. Apenas "bolhaDireita" é necessário.
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
