import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase"; // <-- NOSSO CABO DA NUVEM
import { useAppTheme } from "../_layout";

interface Caixinha {
  id: number;
  nome: string;
  meta_valor: number;
  saldo_atual: number;
  cor: string;
  icone: string;
}

const PALETA_CORES = [
  "#2A9D8F",
  "#E9C46A",
  "#F4A261",
  "#E76F51",
  "#264653",
  "#8AB17D",
  "#8A05BE",
  "#EC7000",
];

export default function CaixinhasScreen() {
  const { isDark, session } = useAppTheme();

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333333" : "#EEEEEE",
    inputFundo: isDark ? "#2C2C2C" : "#FFF",
    barraFundo: isDark ? "#333333" : "#EAEAEA",
    totalCardBg: isDark ? "#1A1A1A" : "#1A1A1A",
    totalCardText: "#FFFFFF",
  };

  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);

  const [modalNovaVisivel, setModalNovaVisivel] = useState(false);
  const [nomeCaixinha, setNomeCaixinha] = useState("");
  const [metaValor, setMetaValor] = useState("");
  const [corSelecionada, setCorSelecionada] = useState(PALETA_CORES[0]);

  const [modalMovimentoVisivel, setModalMovimentoVisivel] = useState(false);
  const [caixaSelecionada, setCaixaSelecionada] = useState<Caixinha | null>(
    null,
  );
  const [valorMovimento, setValorMovimento] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState<"guardar" | "resgatar">(
    "guardar",
  );

  const carregarDados = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase.from("caixinhas").select("*");
      if (data) setCaixinhas(data);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [session]),
  );

  const totalGuardado = caixinhas.reduce(
    (acc, curr) => acc + Number(curr.saldo_atual),
    0,
  );

  const criarCaixinha = async () => {
    if (nomeCaixinha.trim() === "" || metaValor.trim() === "")
      return Alert.alert("Aviso", "Preenche o nome e a meta.");
    const valorNum = parseFloat(metaValor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0)
      return Alert.alert("Aviso", "Valor inválido.");

    const { error } = await supabase.from("caixinhas").insert([
      {
        nome: nomeCaixinha,
        meta_valor: valorNum,
        saldo_atual: 0,
        cor: corSelecionada,
        icone: "savings",
        user_id: session.user.id,
      },
    ]);

    if (error) {
      Alert.alert("Erro", "Não foi possível criar a caixinha.");
    } else {
      setNomeCaixinha("");
      setMetaValor("");
      setModalNovaVisivel(false);
      carregarDados();
    }
  };

  const deletarCaixinha = (id: number, nome: string) => {
    Alert.alert(
      "Apagar Objetivo",
      `Tens a certeza que queres apagar "${nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            await supabase.from("caixinhas").delete().eq("id", id);
            carregarDados();
          },
        },
      ],
    );
  };

  const abrirMovimento = (caixa: Caixinha) => {
    setCaixaSelecionada(caixa);
    setValorMovimento("");
    setTipoMovimento("guardar");
    setModalMovimentoVisivel(true);
  };

  const confirmarMovimento = async () => {
    if (!caixaSelecionada) return;
    const valorNum = parseFloat(valorMovimento.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0)
      return Alert.alert("Aviso", "Valor inválido.");

    let novoSaldo = Number(caixaSelecionada.saldo_atual);
    if (tipoMovimento === "guardar") novoSaldo += valorNum;
    else {
      if (valorNum > novoSaldo)
        return Alert.alert(
          "Aviso",
          "Não podes resgatar mais do que tens guardado!",
        );
      novoSaldo -= valorNum;
    }

    const { error } = await supabase
      .from("caixinhas")
      .update({ saldo_atual: novoSaldo })
      .eq("id", caixaSelecionada.id);

    if (error) {
      Alert.alert("Erro", "Não foi possível atualizar o saldo.");
    } else {
      setModalMovimentoVisivel(false);
      setCaixaSelecionada(null);
      carregarDados();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>
          Meus Objetivos
        </Text>
        <Text style={[styles.subtitle, { color: Cores.textoSecundario }]}>
          Guarda dinheiro para os teus sonhos
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.totalCard, { backgroundColor: Cores.totalCardBg }]}
        >
          <Text style={styles.totalCardTitle}>Total Poupado</Text>
          <Text style={styles.totalCardAmount}>
            R$ {totalGuardado.toFixed(2)}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalNovaVisivel(true)}
          >
            <Text style={styles.addButtonText}>+ Novo Objetivo</Text>
          </TouchableOpacity>
        </View>

        {caixinhas.length === 0 ? (
          <Text style={[styles.emptyText, { color: Cores.textoSecundario }]}>
            Ainda não criaste nenhuma caixinha.
          </Text>
        ) : (
          caixinhas.map((caixa) => {
            const porcentagem = Math.min(
              (Number(caixa.saldo_atual) / Number(caixa.meta_valor)) * 100,
              100,
            );
            const isCompleto = porcentagem === 100;

            return (
              <TouchableOpacity
                key={caixa.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: Cores.cardFundo,
                    borderColor: Cores.borda,
                  },
                ]}
                onPress={() => abrirMovimento(caixa)}
                onLongPress={() => deletarCaixinha(caixa.id, caixa.nome)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <View
                      style={[styles.iconBox, { backgroundColor: caixa.cor }]}
                    >
                      <MaterialIcons
                        name={caixa.icone as any}
                        size={20}
                        color="#FFF"
                      />
                    </View>
                    <Text
                      style={[
                        styles.caixaName,
                        { color: Cores.textoPrincipal },
                      ]}
                    >
                      {caixa.nome}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.caixaPercent,
                      { color: Cores.textoSecundario },
                      isCompleto && { color: "#2A9D8F" },
                    ]}
                  >
                    {isCompleto
                      ? "Concluído! 🎉"
                      : `${porcentagem.toFixed(0)}%`}
                  </Text>
                </View>

                <View style={styles.valuesRow}>
                  <Text
                    style={[
                      styles.currentValue,
                      { color: Cores.textoPrincipal },
                    ]}
                  >
                    R$ {Number(caixa.saldo_atual).toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.targetValue,
                      { color: Cores.textoSecundario },
                    ]}
                  >
                    de R$ {Number(caixa.meta_valor).toFixed(2)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.progressBarBackground,
                    { backgroundColor: Cores.barraFundo },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: isCompleto ? "#2A9D8F" : caixa.cor,
                        width: `${porcentagem}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL CRIAR CAIXINHA */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalNovaVisivel}
        onRequestClose={() => setModalNovaVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Novo Objetivo
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Cores.inputFundo,
                  borderColor: Cores.borda,
                  color: Cores.textoPrincipal,
                },
              ]}
              placeholderTextColor={Cores.textoSecundario}
              placeholder="Nome (Ex: Viagem, PC Novo)"
              value={nomeCaixinha}
              onChangeText={setNomeCaixinha}
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
              placeholderTextColor={Cores.textoSecundario}
              placeholder="Qual é o valor da meta? (Ex: 1500)"
              value={metaValor}
              onChangeText={setMetaValor}
              keyboardType="numeric"
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
                onPress={() => setModalNovaVisivel(false)}
              />
              <Button title="Criar" color="#2A9D8F" onPress={criarCaixinha} />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL MOVIMENTAR DINHEIRO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalMovimentoVisivel}
        onRequestClose={() => setModalMovimentoVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              {caixaSelecionada?.nome}
            </Text>

            <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: Cores.inputFundo },
                  tipoMovimento === "guardar" && { backgroundColor: "#2A9D8F" },
                ]}
                onPress={() => setTipoMovimento("guardar")}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: Cores.textoSecundario },
                    tipoMovimento === "guardar" && { color: "#FFF" },
                  ]}
                >
                  Guardar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: Cores.inputFundo },
                  tipoMovimento === "resgatar" && {
                    backgroundColor: "#E76F51",
                  },
                ]}
                onPress={() => setTipoMovimento("resgatar")}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: Cores.textoSecundario },
                    tipoMovimento === "resgatar" && { color: "#FFF" },
                  ]}
                >
                  Resgatar
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
              placeholderTextColor={Cores.textoSecundario}
              placeholder={
                tipoMovimento === "guardar"
                  ? "Valor a adicionar (Ex: 50)"
                  : "Valor a resgatar (Ex: 50)"
              }
              value={valorMovimento}
              onChangeText={setValorMovimento}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                color="#999"
                onPress={() => setModalMovimentoVisivel(false)}
              />
              <Button
                title="Confirmar"
                color={isDark ? "#FFF" : "#1A1A1A"}
                onPress={confirmarMovimento}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginTop: 4 },
  content: { flex: 1, paddingHorizontal: 20 },
  totalCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 25,
    elevation: 4,
    alignItems: "center",
  },
  totalCardTitle: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalCardAmount: {
    color: "#FFF",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 5,
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: { color: "#1A1A1A", fontWeight: "bold" },
  emptyText: { fontStyle: "italic", textAlign: "center", marginTop: 20 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  caixaName: { fontSize: 18, fontWeight: "bold" },
  caixaPercent: { fontSize: 14, fontWeight: "bold" },
  valuesRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  currentValue: { fontSize: 20, fontWeight: "bold", marginRight: 5 },
  targetValue: { fontSize: 14, fontWeight: "500" },
  progressBarBackground: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: { width: "90%", padding: 25, borderRadius: 16, elevation: 5 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  colorLabel: { fontSize: 14, fontWeight: "500", marginBottom: 10 },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  colorOption: { width: 35, height: 35, borderRadius: 17.5 },
  modalButtons: { flexDirection: "row", justifyContent: "space-around" },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  typeButton: { flex: 1, padding: 12, alignItems: "center" },
  typeButtonText: { fontWeight: "bold" },
});
