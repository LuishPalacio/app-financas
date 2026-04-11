import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router"; // <-- ADICIONADO O useRouter
import React, { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// 1. IMPORTAÇÕES DA NOSSA NOVA ARQUITETURA
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../_layout";

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
  tipo: string;
  ativa: number;
}
interface Conta {
  id: number;
  nome: string;
  saldo_inicial: number;
  compartilhado: boolean;
}
interface Transacao {
  id: number;
  tipo: string;
  valor: number;
  data_vencimento: string;
  descricao: string;
  categoria_id: number | null;
  conta_id: number;
  status: string;
}

const PALETA_CORES = [
  "#2A9D8F",
  "#E9C46A",
  "#F4A261",
  "#E76F51",
  "#264653",
  "#8AB17D",
];

const getEstiloBanco = (nome: string, isDark: boolean) => {
  const n = nome.toLowerCase();
  if (n.includes("nu") || n.includes("nubank"))
    return { bg: "#8A05BE", text: "#FFF" };
  if (n.includes("itaú") || n.includes("itau"))
    return { bg: "#EC7000", text: "#FFF" };
  if (n.includes("inter")) return { bg: "#FF7A00", text: "#FFF" };
  if (n.includes("bradesco")) return { bg: "#CC092F", text: "#FFF" };
  if (n.includes("brasil") || n.includes("bb"))
    return { bg: "#F9D300", text: "#0038A8" };
  if (n.includes("santander")) return { bg: "#EC0000", text: "#FFF" };
  if (n.includes("caixa")) return { bg: "#005CA9", text: "#FFF" };
  if (n.includes("c6")) return { bg: "#242424", text: "#FFF" };
  if (n.includes("carteira") || n.includes("dinheiro"))
    return { bg: "#2A9D8F", text: "#FFF" };

  return {
    bg: isDark ? "#333333" : "#F8F9FA",
    text: isDark ? "#FFFFFF" : "#333333",
  };
};

export default function Dashboard() {
  const { isDark, session } = useAppTheme();
  const router = useRouter(); // <-- DECLARAÇÃO DO ROUTER PARA A NAVEGAÇÃO DA IA

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#ffffff",
    borda: isDark ? "#333333" : "#DDDDDD",
    inputFundo: isDark ? "#2C2C2C" : "#ffffff",
    pillFundo: isDark ? "#333333" : "#F0F0F0",
    pillAtivo: isDark ? "#555555" : "#EAEAEA",
  };

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [temParceiro, setTemParceiro] = useState(false);

  // CONTROLE DO MÊS PARA O FLUXO DE CAIXA
  const [mesAtual, setMesAtual] = useState(new Date());

  const alterarMes = (direcao: number) => {
    const novoMes = new Date(mesAtual);
    novoMes.setMonth(novoMes.getMonth() + direcao);
    setMesAtual(novoMes);
  };

  // CORREÇÃO ANDROID HERMES
  const mesesEmPortugues = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const nomeDoMes = `${mesesEmPortugues[mesAtual.getMonth()]} de ${mesAtual.getFullYear()}`;

  const [modalCatVisivel, setModalCatVisivel] = useState(false);
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [corSelecionada, setCorSelecionada] = useState(PALETA_CORES[0]);
  const [tipoNovaCategoria, setTipoNovaCategoria] = useState<
    "receita" | "despesa"
  >("despesa");

  const [modalContaVisivel, setModalContaVisivel] = useState(false);
  const [nomeConta, setNomeConta] = useState("");
  const [saldoInicialConta, setSaldoInicialConta] = useState("");
  const [contaCompartilhada, setContaCompartilhada] = useState(false);

  const [modalTransVisivel, setModalTransVisivel] = useState(false);
  const [descTransacao, setDescTransacao] = useState("");
  const [valorTransacao, setValorTransacao] = useState("");
  const [tipoTransacao, setTipoTransacao] = useState<
    "receita" | "despesa" | "transferencia"
  >("despesa");
  const [catSelecionadaId, setCatSelecionadaId] = useState<number | null>(null);
  const [contaSelecionadaId, setContaSelecionadaId] = useState<number | null>(
    null,
  );
  const [contaDestinoId, setContaDestinoId] = useState<number | null>(null);

  const [frequencia, setFrequencia] = useState<"unica" | "parcelada" | "fixa">(
    "unica",
  );
  const [numParcelas, setNumParcelas] = useState("2");
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [foiPago, setFoiPago] = useState(true);

  // --- MATEMÁTICA DO APLICATIVO ---
  const saldoInicialTotal = contas.reduce(
    (acc, curr) => acc + curr.saldo_inicial,
    0,
  );
  const receitasRealizadas = transacoes
    .filter((t) => t.tipo === "receita" && t.status === "paga")
    .reduce((acc, curr) => acc + curr.valor, 0);
  const despesasRealizadas = transacoes
    .filter((t) => t.tipo === "despesa" && t.status === "paga")
    .reduce((acc, curr) => acc + curr.valor, 0);
  const saldoAtualGlobal =
    saldoInicialTotal + receitasRealizadas - despesasRealizadas;

  const transacoesDoMes = transacoes.filter((t) => {
    const dataT = new Date(t.data_vencimento);
    const dataAjustada = new Date(
      dataT.getTime() + dataT.getTimezoneOffset() * 60000,
    );
    return (
      dataAjustada.getMonth() === mesAtual.getMonth() &&
      dataAjustada.getFullYear() === mesAtual.getFullYear()
    );
  });

  const receitasDoMes = transacoesDoMes
    .filter((t) => t.tipo === "receita")
    .reduce((acc, curr) => acc + curr.valor, 0);
  const despesasDoMes = transacoesDoMes
    .filter((t) => t.tipo === "despesa")
    .reduce((acc, curr) => acc + curr.valor, 0);
  const balancoMensal = receitasDoMes - despesasDoMes;

  // --- LÓGICA OFFLINE-FIRST ---
  const carregarDados = async () => {
    if (!session?.user?.id) return;

    try {
      const [resCategorias, resContas, resTransacoes, resParceria] =
        await Promise.all([
          supabase.from("categorias").select("*"),
          supabase.from("contas").select("*"),
          supabase.from("transacoes").select("*"),
          supabase
            .from("parcerias")
            .select("id")
            .eq("status", "aceito")
            .or(
              `solicitante_id.eq.${session.user.id},convidado_id.eq.${session.user.id}`,
            ),
        ]);

      if (resCategorias.error || resContas.error || resTransacoes.error) {
        throw new Error("Sem conexão");
      }

      if (resCategorias.data) setCategorias(resCategorias.data);
      if (resContas.data) setContas(resContas.data);
      if (resTransacoes.data) setTransacoes(resTransacoes.data);

      const temParc = resParceria.data ? resParceria.data.length > 0 : false;
      setTemParceiro(temParc);

      // SALVA O CACHE LOCAL
      await AsyncStorage.setItem(
        "@cache_categorias",
        JSON.stringify(resCategorias.data ?? []),
      );
      await AsyncStorage.setItem(
        "@cache_contas",
        JSON.stringify(resContas.data ?? []),
      );
      await AsyncStorage.setItem(
        "@cache_transacoes",
        JSON.stringify(resTransacoes.data ?? []),
      );
      await AsyncStorage.setItem("@cache_parceiro", JSON.stringify(temParc));
    } catch (error) {
      console.log("Internet falhou. Carregando dados locais...");

      const catCache = await AsyncStorage.getItem("@cache_categorias");
      const conCache = await AsyncStorage.getItem("@cache_contas");
      const transCache = await AsyncStorage.getItem("@cache_transacoes");
      const parcCache = await AsyncStorage.getItem("@cache_parceiro");

      if (catCache) setCategorias(JSON.parse(catCache));
      if (conCache) setContas(JSON.parse(conCache));
      if (transCache) setTransacoes(JSON.parse(transCache));
      if (parcCache) setTemParceiro(JSON.parse(parcCache));

      Alert.alert(
        "Modo Offline",
        "Você está sem internet. Mostrando seus últimos dados salvos.",
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [session]),
  );

  const calcularSaldoConta = (conta: Conta) => {
    const transDaConta = transacoes.filter(
      (t) => t.conta_id === conta.id && t.status === "paga",
    );
    const rec = transDaConta
      .filter((t) => t.tipo === "receita")
      .reduce((acc, curr) => acc + curr.valor, 0);
    const desp = transDaConta
      .filter((t) => t.tipo === "despesa")
      .reduce((acc, curr) => acc + curr.valor, 0);
    return Number(conta.saldo_inicial) + rec - desp;
  };

  const salvarCategoria = async () => {
    if (nomeCategoria.trim() === "")
      return Alert.alert("Aviso", "Escreve um nome.");
    const { error } = await supabase.from("categorias").insert([
      {
        nome: nomeCategoria,
        cor: corSelecionada,
        icone: "label",
        tipo: tipoNovaCategoria,
        ativa: 1,
        user_id: session.user.id,
      },
    ]);
    if (error) return Alert.alert("Erro", "Falha ao salvar categoria.");
    setNomeCategoria("");
    setTipoNovaCategoria("despesa");
    setModalCatVisivel(false);
    carregarDados();
  };

  const salvarConta = async () => {
    if (nomeConta.trim() === "")
      return Alert.alert("Aviso", "Dá um nome à conta.");
    const saldoNum = parseFloat(saldoInicialConta.replace(",", ".")) || 0;

    const { error } = await supabase.from("contas").insert([
      {
        nome: nomeConta,
        saldo_inicial: saldoNum,
        user_id: session.user.id,
        compartilhado: contaCompartilhada,
      },
    ]);

    if (error) return Alert.alert("Erro", "Falha ao salvar conta.");

    setNomeConta("");
    setSaldoInicialConta("");
    setContaCompartilhada(false);
    setModalContaVisivel(false);
    carregarDados();
  };

  const deletarConta = (id: number, nome: string) => {
    Alert.alert(
      "Eliminar Conta",
      `Tens a certeza que desejas apagar "${nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("contas")
              .delete()
              .eq("id", id);
            if (error)
              Alert.alert(
                "Não foi possível",
                "Apague as transações desta conta primeiro.",
              );
            else carregarDados();
          },
        },
      ],
    );
  };

  const aoMudarData = (event: any, dataEscolhida?: Date) => {
    setMostrarCalendario(false);
    if (dataEscolhida) setDataSelecionada(dataEscolhida);
  };

  const formatarDataBR = (data: Date) => {
    const d = String(data.getDate()).padStart(2, "0");
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const a = data.getFullYear();
    return `${d}/${m}/${a}`;
  };

  const salvarTransacao = async () => {
    if (descTransacao.trim() === "" || valorTransacao.trim() === "")
      return Alert.alert("Aviso", "Preenche a descrição e o valor.");
    const valorNum = parseFloat(valorTransacao.replace(",", "."));
    if (isNaN(valorNum)) return Alert.alert("Aviso", "Valor inválido.");

    let totalRepeticoes = 1;
    let valorFinal = valorNum;

    if (frequencia === "parcelada") {
      totalRepeticoes = parseInt(numParcelas);
      if (isNaN(totalRepeticoes) || totalRepeticoes < 2)
        return Alert.alert("Aviso", "Número de parcelas inválido.");
      valorFinal = valorNum / totalRepeticoes;
    } else if (frequencia === "fixa") {
      totalRepeticoes = 12;
    }

    const statusBd = foiPago ? "paga" : "pendente";
    const novasTransacoes = [];

    for (let i = 0; i < totalRepeticoes; i++) {
      const dataIteracao = new Date(
        dataSelecionada.getFullYear(),
        dataSelecionada.getMonth() + i,
        dataSelecionada.getDate(),
      );
      const dataFormatadaSql = `${dataIteracao.getFullYear()}-${String(dataIteracao.getMonth() + 1).padStart(2, "0")}-${String(dataIteracao.getDate()).padStart(2, "0")}`;
      let descFinal = descTransacao;
      if (frequencia === "parcelada")
        descFinal = `${descTransacao} (${i + 1}/${totalRepeticoes})`;
      if (frequencia === "fixa") descFinal = `${descTransacao} (Fixa)`;

      if (tipoTransacao === "transferencia") {
        if (!contaSelecionadaId || !contaDestinoId)
          return Alert.alert("Aviso", "Seleciona a origem e destino.");
        if (contaSelecionadaId === contaDestinoId)
          return Alert.alert("Aviso", "As contas não podem ser iguais.");

        novasTransacoes.push({
          tipo: "despesa",
          valor: valorFinal,
          data_vencimento: dataFormatadaSql,
          status: statusBd,
          descricao: `[Transf.] ${descFinal}`,
          categoria_id: null,
          conta_id: contaSelecionadaId,
          user_id: session.user.id,
        });
        novasTransacoes.push({
          tipo: "receita",
          valor: valorFinal,
          data_vencimento: dataFormatadaSql,
          status: statusBd,
          descricao: `[Transf.] ${descFinal}`,
          categoria_id: null,
          conta_id: contaDestinoId,
          user_id: session.user.id,
        });
      } else {
        if (!catSelecionadaId || !contaSelecionadaId)
          return Alert.alert("Aviso", "Seleciona a conta e categoria.");
        novasTransacoes.push({
          tipo: tipoTransacao,
          valor: valorFinal,
          data_vencimento: dataFormatadaSql,
          status: statusBd,
          descricao: descFinal,
          categoria_id: catSelecionadaId,
          conta_id: contaSelecionadaId,
          user_id: session.user.id,
        });
      }
    }

    const { error } = await supabase.from("transacoes").insert(novasTransacoes);
    if (error)
      return Alert.alert("Erro", "Falha ao guardar os registos na nuvem.");

    setDescTransacao("");
    setValorTransacao("");
    setCatSelecionadaId(null);
    setContaSelecionadaId(null);
    setContaDestinoId(null);
    setFrequencia("unica");
    setNumParcelas("2");
    setDataSelecionada(new Date());
    setFoiPago(true);
    setModalTransVisivel(false);
    carregarDados();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: Cores.textoPrincipal }]}>
            Olá,{" "}
            {session?.user?.user_metadata?.nome_usuario ||
              session?.user?.email?.split("@")[0] ||
              "Usuário"}
            !
          </Text>
          <Text style={[styles.subtitle, { color: Cores.textoSecundario }]}>
            O teu painel financeiro na nuvem ☁️
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionScroll}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#457B9D" }]}
            onPress={() => setModalContaVisivel(true)}
          >
            <Text style={styles.actionButtonText}>+ Conta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#2A9D8F" }]}
            onPress={() => setModalCatVisivel(true)}
          >
            <Text style={styles.actionButtonText}>+ Categoria</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#E76F51" }]}
            onPress={() => setModalTransVisivel(true)}
          >
            <Text style={styles.actionButtonText}>+ Transação</Text>
          </TouchableOpacity>

          {/* BOTÃO DA IA QUE LEVA PARA A TELA NOVA */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#1D3557" }]}
            onPress={() => router.push("/chat-ia")}
          >
            <Text style={styles.actionButtonText}>✨ Consultor IA</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- NOVO CARTÃO DE FLUXO DE CAIXA --- */}
        <View style={styles.balanceCard}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <TouchableOpacity
              onPress={() => alterarMes(-1)}
              style={{
                padding: 8,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 20,
              }}
            >
              <MaterialIcons name="chevron-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#FFF",
                textTransform: "capitalize",
              }}
            >
              {nomeDoMes}
            </Text>
            <TouchableOpacity
              onPress={() => alterarMes(1)}
              style={{
                padding: 8,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 20,
              }}
            >
              <MaterialIcons name="chevron-right" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceTitle}>Saldo Global (Na Conta)</Text>
          <Text style={styles.balanceAmount}>
            R$ {saldoAtualGlobal.toFixed(2)}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
              paddingTop: 15,
              borderTopWidth: 1,
              borderTopColor: "#333",
            }}
          >
            <View>
              <Text style={{ color: "#999", fontSize: 12 }}>
                Entradas do Mês
              </Text>
              <Text
                style={{ color: "#8AB17D", fontWeight: "bold", fontSize: 16 }}
              >
                + R$ {receitasDoMes.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={{ color: "#999", fontSize: 12, textAlign: "right" }}>
                Saídas do Mês
              </Text>
              <Text
                style={{
                  color: "#E76F51",
                  fontWeight: "bold",
                  fontSize: 16,
                  textAlign: "right",
                }}
              >
                - R$ {despesasDoMes.toFixed(2)}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 15,
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#999", fontSize: 12 }}>Balanço do Mês</Text>
            <Text
              style={{
                color: balancoMensal >= 0 ? "#8AB17D" : "#E76F51",
                fontWeight: "bold",
                fontSize: 20,
              }}
            >
              R$ {balancoMensal.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, { color: Cores.textoPrincipal }]}
            >
              As Minhas Contas
            </Text>
            <Text style={[styles.hintText, { color: Cores.textoSecundario }]}>
              (Segura para apagar)
            </Text>
          </View>

          {contas.length === 0 ? (
            <Text style={[styles.emptyText, { color: Cores.textoSecundario }]}>
              Ainda não registaste nenhuma conta.
            </Text>
          ) : (
            <View style={styles.accountsGrid}>
              {contas.map((conta) => {
                const estilo = getEstiloBanco(conta.nome, isDark);
                return (
                  <TouchableOpacity
                    key={conta.id}
                    style={[
                      styles.accountCard,
                      {
                        backgroundColor: estilo.bg,
                        borderColor: isDark ? Cores.borda : estilo.bg,
                        borderWidth: isDark ? 1 : 0,
                      },
                    ]}
                    onLongPress={() => deletarConta(conta.id, conta.nome)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text
                        style={[styles.accountName, { color: estilo.text }]}
                      >
                        {conta.nome}
                      </Text>
                      {conta.compartilhado && (
                        <View
                          style={{
                            marginLeft: 8,
                            backgroundColor: "rgba(255,255,255,0.2)",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <MaterialIcons
                            name="people"
                            size={14}
                            color={estilo.text}
                          />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.accountBalance, { color: estilo.text }]}
                    >
                      R$ {calcularSaldoConta(conta).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL DA CONTA */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalContaVisivel}
        onRequestClose={() => setModalContaVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Nova Conta
            </Text>

            {temParceiro && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 15,
                  padding: 10,
                  backgroundColor: Cores.pillFundo,
                  borderRadius: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <MaterialIcons
                    name="people"
                    size={20}
                    color="#E76F51"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{ color: Cores.textoPrincipal, fontWeight: "500" }}
                  >
                    Conta Conjunta?
                  </Text>
                </View>
                <Switch
                  value={contaCompartilhada}
                  onValueChange={setContaCompartilhada}
                  trackColor={{ false: "#767577", true: "#E76F51" }}
                />
              </View>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Cores.inputFundo,
                  borderColor: Cores.borda,
                  color: Cores.textoPrincipal,
                },
              ]}
              placeholder="Nome (ex: Itaú Casa, Carteira)"
              placeholderTextColor={Cores.textoSecundario}
              value={nomeConta}
              onChangeText={setNomeConta}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Cores.inputFundo,
                  borderColor: Cores.borda,
                  color: Cores.textoPrincipal,
                },
              ]}
              placeholder="Saldo Inicial (ex: 100.00)"
              placeholderTextColor={Cores.textoSecundario}
              value={saldoInicialConta}
              onChangeText={setSaldoInicialConta}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                color="#999"
                onPress={() => setModalContaVisivel(false)}
              />
              <Button title="Guardar" color="#457B9D" onPress={salvarConta} />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DA CATEGORIA */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalCatVisivel}
        onRequestClose={() => setModalCatVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Criar Categoria
            </Text>
            <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  tipoNovaCategoria === "despesa" && styles.expenseSelected,
                ]}
                onPress={() => setTipoNovaCategoria("despesa")}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    tipoNovaCategoria === "despesa"
                      ? { color: "#FFF" }
                      : { color: Cores.textoSecundario },
                  ]}
                >
                  Despesas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  tipoNovaCategoria === "receita" && styles.incomeSelected,
                ]}
                onPress={() => setTipoNovaCategoria("receita")}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    tipoNovaCategoria === "receita"
                      ? { color: "#FFF" }
                      : { color: Cores.textoSecundario },
                  ]}
                >
                  Receitas
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Cores.inputFundo,
                  borderColor: Cores.borda,
                  color: Cores.textoPrincipal,
                },
              ]}
              placeholder="Nome (ex: Lazer, Vendas)"
              placeholderTextColor={Cores.textoSecundario}
              value={nomeCategoria}
              onChangeText={setNomeCategoria}
            />
            <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>
              Escolha uma cor:
            </Text>
            <View style={styles.colorPalette}>
              {PALETA_CORES.map((cor) => (
                <TouchableOpacity
                  key={cor}
                  style={[
                    styles.colorOption,
                    { backgroundColor: cor },
                    corSelecionada === cor && {
                      borderWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setCorSelecionada(cor)}
                />
              ))}
            </View>
            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                color="#999"
                onPress={() => setModalCatVisivel(false)}
              />
              <Button
                title="Guardar"
                color="#2A9D8F"
                onPress={salvarCategoria}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DA TRANSAÇÃO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalTransVisivel}
        onRequestClose={() => setModalTransVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollModalContent}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: Cores.cardFundo },
              ]}
            >
              <Text
                style={[styles.modalTitle, { color: Cores.textoPrincipal }]}
              >
                Nova Transação
              </Text>
              <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    tipoTransacao === "despesa" && styles.expenseSelected,
                  ]}
                  onPress={() => {
                    setTipoTransacao("despesa");
                    setCatSelecionadaId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      tipoTransacao === "despesa"
                        ? { color: "#FFF" }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Despesa
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    tipoTransacao === "receita" && styles.incomeSelected,
                  ]}
                  onPress={() => {
                    setTipoTransacao("receita");
                    setCatSelecionadaId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      tipoTransacao === "receita"
                        ? { color: "#FFF" }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Receita
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    tipoTransacao === "transferencia" &&
                      styles.transferSelected,
                  ]}
                  onPress={() => setTipoTransacao("transferencia")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      tipoTransacao === "transferencia"
                        ? { color: "#FFF" }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Transf.
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[styles.colorLabel, { color: Cores.textoSecundario }]}
              >
                Status:
              </Text>
              <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
                <TouchableOpacity
                  style={[
                    styles.freqButton,
                    { backgroundColor: Cores.pillFundo },
                    foiPago && {
                      backgroundColor: Cores.pillAtivo,
                      borderBottomWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setFoiPago(true)}
                >
                  <Text
                    style={[
                      styles.freqButtonText,
                      foiPago
                        ? { color: Cores.textoPrincipal }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    {tipoTransacao === "receita" ? "Já Recebido" : "Já Pago"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.freqButton,
                    { backgroundColor: Cores.pillFundo },
                    !foiPago && {
                      backgroundColor: Cores.pillAtivo,
                      borderBottomWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setFoiPago(false)}
                >
                  <Text
                    style={[
                      styles.freqButtonText,
                      !foiPago
                        ? { color: Cores.textoPrincipal }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    {tipoTransacao === "receita" ? "A Receber" : "A Pagar"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[styles.colorLabel, { color: Cores.textoSecundario }]}
              >
                Repetição:
              </Text>
              <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
                <TouchableOpacity
                  style={[
                    styles.freqButton,
                    { backgroundColor: Cores.pillFundo },
                    frequencia === "unica" && {
                      backgroundColor: Cores.pillAtivo,
                      borderBottomWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setFrequencia("unica")}
                >
                  <Text
                    style={[
                      styles.freqButtonText,
                      frequencia === "unica"
                        ? { color: Cores.textoPrincipal }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Única
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.freqButton,
                    { backgroundColor: Cores.pillFundo },
                    frequencia === "parcelada" && {
                      backgroundColor: Cores.pillAtivo,
                      borderBottomWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setFrequencia("parcelada")}
                >
                  <Text
                    style={[
                      styles.freqButtonText,
                      frequencia === "parcelada"
                        ? { color: Cores.textoPrincipal }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Parcelada
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.freqButton,
                    { backgroundColor: Cores.pillFundo },
                    frequencia === "fixa" && {
                      backgroundColor: Cores.pillAtivo,
                      borderBottomWidth: 3,
                      borderColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => setFrequencia("fixa")}
                >
                  <Text
                    style={[
                      styles.freqButtonText,
                      frequencia === "fixa"
                        ? { color: Cores.textoPrincipal }
                        : { color: Cores.textoSecundario },
                    ]}
                  >
                    Fixa Mensal
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Cores.inputFundo,
                    borderColor: Cores.borda,
                    color: Cores.textoPrincipal,
                  },
                ]}
                placeholder="Descrição"
                placeholderTextColor={Cores.textoSecundario}
                value={descTransacao}
                onChangeText={setDescTransacao}
              />

              <View style={styles.rowInputs}>
                <TouchableOpacity
                  style={[
                    styles.input,
                    {
                      backgroundColor: Cores.pillFundo,
                      borderColor: Cores.borda,
                      flex: 1,
                      marginRight: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                  onPress={() => setMostrarCalendario(true)}
                >
                  <MaterialIcons
                    name="calendar-today"
                    size={20}
                    color={Cores.textoSecundario}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.datePickerText,
                      { color: Cores.textoPrincipal },
                    ]}
                  >
                    {formatarDataBR(dataSelecionada)}
                  </Text>
                </TouchableOpacity>
                {mostrarCalendario && (
                  <DateTimePicker
                    value={dataSelecionada}
                    mode="date"
                    display="default"
                    onChange={aoMudarData}
                  />
                )}

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: Cores.inputFundo,
                      borderColor: Cores.borda,
                      color: Cores.textoPrincipal,
                      flex: 1,
                      marginRight: frequencia === "parcelada" ? 10 : 0,
                    },
                  ]}
                  placeholder={
                    frequencia === "parcelada"
                      ? "Valor Total"
                      : "Valor (Ex: 50)"
                  }
                  placeholderTextColor={Cores.textoSecundario}
                  value={valorTransacao}
                  onChangeText={setValorTransacao}
                  keyboardType="numeric"
                />
                {frequencia === "parcelada" && (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: Cores.inputFundo,
                        borderColor: Cores.borda,
                        color: Cores.textoPrincipal,
                        width: 80,
                      },
                    ]}
                    placeholder="Vezes"
                    placeholderTextColor={Cores.textoSecundario}
                    value={numParcelas}
                    onChangeText={setNumParcelas}
                    keyboardType="numeric"
                  />
                )}
              </View>

              <Text
                style={[styles.colorLabel, { color: Cores.textoSecundario }]}
              >
                {tipoTransacao === "transferencia"
                  ? "Conta de Origem (Sai):"
                  : "Qual Conta?"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScroll}
              >
                {contas.map((conta) => (
                  <TouchableOpacity
                    key={conta.id}
                    style={[
                      styles.catPill,
                      { backgroundColor: Cores.pillFundo },
                      contaSelecionadaId === conta.id && {
                        borderColor: "#457B9D",
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setContaSelecionadaId(conta.id)}
                  >
                    <MaterialIcons
                      name="account-balance-wallet"
                      size={16}
                      color={
                        contaSelecionadaId === conta.id
                          ? "#457B9D"
                          : Cores.textoSecundario
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: Cores.textoPrincipal }}>
                      {conta.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {tipoTransacao === "transferencia" ? (
                <>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: Cores.textoSecundario },
                    ]}
                  >
                    Conta de Destino (Entra):
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.catScroll}
                  >
                    {contas.map((conta) => (
                      <TouchableOpacity
                        key={`dest-${conta.id}`}
                        style={[
                          styles.catPill,
                          { backgroundColor: Cores.pillFundo },
                          contaDestinoId === conta.id && {
                            borderColor: "#2A9D8F",
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => setContaDestinoId(conta.id)}
                      >
                        <MaterialIcons
                          name="account-balance-wallet"
                          size={16}
                          color={
                            contaDestinoId === conta.id
                              ? "#2A9D8F"
                              : Cores.textoSecundario
                          }
                          style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: Cores.textoPrincipal }}>
                          {conta.nome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: Cores.textoSecundario },
                    ]}
                  >
                    Categoria:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.catScroll}
                  >
                    {categorias
                      .filter((c) => c.ativa !== 0 && c.tipo === tipoTransacao)
                      .map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.catPill,
                            { backgroundColor: Cores.pillFundo },
                            catSelecionadaId === cat.id && {
                              borderColor: cat.cor,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => setCatSelecionadaId(cat.id)}
                        >
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: cat.cor },
                            ]}
                          />
                          <Text style={{ color: Cores.textoPrincipal }}>
                            {cat.nome}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              )}

              <View style={styles.modalButtons}>
                <Button
                  title="Cancelar"
                  color="#999"
                  onPress={() => setModalTransVisivel(false)}
                />
                <Button
                  title="Guardar"
                  color={isDark ? "#FFF" : "#1A1A1A"}
                  onPress={salvarTransacao}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 20, marginTop: 10 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 16, marginTop: 4 },
  actionScroll: { flexDirection: "row", marginBottom: 20 },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  balanceCard: {
    backgroundColor: "#1A1A1A",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },
  balanceTitle: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceAmount: {
    color: "#FFF",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 5,
  },
  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold" },
  hintText: { fontSize: 12, fontStyle: "italic" },
  emptyText: { fontStyle: "italic", textAlign: "center", marginTop: 10 },
  accountsGrid: { gap: 10 },
  accountCard: {
    padding: 20,
    borderRadius: 12,
    minWidth: "100%",
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountName: { fontSize: 16, fontWeight: "600" },
  accountBalance: { fontSize: 20, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
  },
  scrollModalContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  modalContent: { width: "95%", padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  datePickerText: { fontSize: 16, fontWeight: "500" },
  rowInputs: { flexDirection: "row", justifyContent: "space-between" },
  colorLabel: { fontSize: 14, fontWeight: "500", marginBottom: 10 },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  colorOption: { width: 35, height: 35, borderRadius: 17.5 },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 15,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  typeButton: { flex: 1, padding: 12, alignItems: "center" },
  typeButtonText: { fontWeight: "bold" },
  expenseSelected: { backgroundColor: "#E76F51" },
  incomeSelected: { backgroundColor: "#2A9D8F" },
  transferSelected: { backgroundColor: "#457B9D" },
  freqButton: { flex: 1, padding: 10, alignItems: "center" },
  freqButtonText: { fontSize: 13, fontWeight: "600" },
  catScroll: { flexDirection: "row", marginBottom: 15 },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
});
