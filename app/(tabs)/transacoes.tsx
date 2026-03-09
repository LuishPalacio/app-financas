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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase"; // <-- NOSSO CABO DA NUVEM
import { useAppTheme } from "../_layout";

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
  ativa: number;
}
interface Conta {
  id: number;
  nome: string;
  saldo_inicial: number;
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
  return { bg: isDark ? "#333" : "#E3F2FD", text: isDark ? "#FFF" : "#1976D2" };
};

const getNomeMes = (mes: string) => {
  const meses = [
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
  return meses[parseInt(mes, 10) - 1];
};

const formatarMesAno = (yyyymm: string) => {
  if (!yyyymm) return "";
  const [ano, mes] = yyyymm.split("-");
  return `${getNomeMes(mes)} ${ano}`;
};

export default function TransacoesScreen() {
  const { isDark, session } = useAppTheme();

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#ffffff",
    blocoData: isDark ? "#2C2C2C" : "#F0F0F0",
    borda: isDark ? "#333333" : "#EEEEEE",
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
    transacaoBg: isDark ? "#121212" : "#FFF",
    pendenteBg: isDark ? "#1A1A1A" : "#FAFAFA",
  };

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  const [filtroContas, setFiltroContas] = useState<number[]>([]);
  const [filtroCategorias, setFiltroCategorias] = useState<number[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<
    "todas" | "receita" | "despesa" | "transferencia"
  >("todas");

  const [modalFiltroConta, setModalFiltroConta] = useState(false);
  const [modalFiltroCat, setModalFiltroCat] = useState(false);
  const [modalFiltroTipo, setModalFiltroTipo] = useState(false);

  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtualStr);

  const carregarDados = async () => {
    if (!session?.user?.id) return;
    try {
      const [resCategorias, resContas, resTransacoes] = await Promise.all([
        supabase.from("categorias").select("*"),
        supabase.from("contas").select("*"),
        supabase.from("transacoes").select("*"),
      ]);
      if (resCategorias.data) setCategorias(resCategorias.data);
      if (resContas.data) setContas(resContas.data);
      if (resTransacoes.data) setTransacoes(resTransacoes.data);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [session]),
  );

  const deletarTransacao = async (id: number) => {
    Alert.alert("Excluir", "Tem certeza que deseja apagar esta transação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("transacoes")
            .delete()
            .eq("id", id);
          if (!error) carregarDados();
        },
      },
    ]);
  };

  const alternarStatus = async (id: number, statusAtual: string) => {
    const novoStatus = statusAtual === "paga" ? "pendente" : "paga";
    const { error } = await supabase
      .from("transacoes")
      .update({ status: novoStatus })
      .eq("id", id);
    if (error) {
      Alert.alert("Erro", "Não foi possível atualizar o estado.");
    } else {
      carregarDados();
    }
  };

  const toggleFiltroConta = (id: number) =>
    setFiltroContas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  const toggleFiltroCategoria = (id: number) =>
    setFiltroCategorias((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const transacoesDoMes = transacoes
    .filter((t) => {
      const passaConta =
        filtroContas.length === 0 || filtroContas.includes(t.conta_id);
      const passaCategoria =
        filtroCategorias.length === 0 ||
        (t.categoria_id !== null && filtroCategorias.includes(t.categoria_id));
      const dataSegura =
        t.data_vencimento || new Date().toISOString().split("T")[0];
      const passaMes = dataSegura.startsWith(mesSelecionado);

      let passaTipo = true;
      const isTransferencia = t.descricao.includes("[Transf.]");
      if (filtroTipo === "transferencia") {
        passaTipo = isTransferencia;
      } else if (filtroTipo === "receita") {
        passaTipo = t.tipo === "receita" && !isTransferencia;
      } else if (filtroTipo === "despesa") {
        passaTipo = t.tipo === "despesa" && !isTransferencia;
      }

      return passaConta && passaCategoria && passaMes && passaTipo;
    })
    .sort((a, b) => {
      const dataA = a.data_vencimento || "";
      const dataB = b.data_vencimento || "";
      return dataB.localeCompare(dataA);
    });

  const anoAtual = new Date().getFullYear();
  const mesesDoAno = Array.from(
    { length: 12 },
    (_, i) => `${anoAtual}-${String(i + 1).padStart(2, "0")}`,
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <View style={[styles.header, { backgroundColor: Cores.fundo }]}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>
          Livro-Caixa {anoAtual}
        </Text>
      </View>

      <View style={styles.filterButtonsRow}>
        <TouchableOpacity
          style={[
            styles.mainFilterButton,
            { backgroundColor: Cores.pillFundo },
          ]}
          onPress={() => setModalFiltroTipo(true)}
        >
          <MaterialIcons
            name="swap-vert"
            size={18}
            color={filtroTipo !== "todas" ? "#F4A261" : Cores.textoSecundario}
          />
          <Text
            style={[
              styles.mainFilterText,
              {
                color:
                  filtroTipo !== "todas" ? "#F4A261" : Cores.textoSecundario,
              },
            ]}
            numberOfLines={1}
          >
            {filtroTipo === "todas"
              ? "Tipo"
              : filtroTipo === "receita"
                ? "Receitas"
                : filtroTipo === "despesa"
                  ? "Despesas"
                  : "Transf."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mainFilterButton,
            { backgroundColor: Cores.pillFundo },
          ]}
          onPress={() => setModalFiltroConta(true)}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={18}
            color={filtroContas.length > 0 ? "#457B9D" : Cores.textoSecundario}
          />
          <Text
            style={[
              styles.mainFilterText,
              {
                color:
                  filtroContas.length > 0 ? "#457B9D" : Cores.textoSecundario,
              },
            ]}
            numberOfLines={1}
          >
            Contas {filtroContas.length > 0 ? `(${filtroContas.length})` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mainFilterButton,
            { backgroundColor: Cores.pillFundo },
          ]}
          onPress={() => setModalFiltroCat(true)}
        >
          <MaterialIcons
            name="label"
            size={18}
            color={
              filtroCategorias.length > 0 ? "#2A9D8F" : Cores.textoSecundario
            }
          />
          <Text
            style={[
              styles.mainFilterText,
              {
                color:
                  filtroCategorias.length > 0
                    ? "#2A9D8F"
                    : Cores.textoSecundario,
              },
            ]}
            numberOfLines={1}
          >
            Categ.{" "}
            {filtroCategorias.length > 0 ? `(${filtroCategorias.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mesesScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        >
          {mesesDoAno.map((yyyymm) => {
            const isAtivo = mesSelecionado === yyyymm;
            const nomeDoMes = getNomeMes(yyyymm.split("-")[1]);
            return (
              <TouchableOpacity
                key={yyyymm}
                style={[
                  styles.mesPill,
                  {
                    backgroundColor: isAtivo
                      ? Cores.textoPrincipal
                      : Cores.pillFundo,
                    borderColor: isAtivo ? Cores.textoPrincipal : Cores.borda,
                  },
                ]}
                onPress={() => setMesSelecionado(yyyymm)}
              >
                <Text
                  style={[
                    styles.mesPillText,
                    { color: isAtivo ? Cores.fundo : Cores.textoSecundario },
                  ]}
                >
                  {nomeDoMes}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.listContainer}>
        <View
          style={[
            styles.monthBlock,
            { backgroundColor: Cores.cardFundo, borderColor: Cores.borda },
          ]}
        >
          <View
            style={[
              styles.monthHeader,
              {
                backgroundColor: isDark ? "#252525" : "#F8F9FA",
                borderColor: Cores.borda,
              },
            ]}
          >
            <Text
              style={[styles.monthHeaderText, { color: Cores.textoPrincipal }]}
            >
              {formatarMesAno(mesSelecionado)}
            </Text>
          </View>

          {transacoesDoMes.length === 0 ? (
            <Text
              style={[styles.emptyMonthText, { color: Cores.textoSecundario }]}
            >
              Nenhum registro encontrado com estes filtros.
            </Text>
          ) : (
            transacoesDoMes.map((t) => {
              const categoria = categorias.find((c) => c.id === t.categoria_id);
              const conta = contas.find((c) => c.id === t.conta_id);
              const estiloConta = conta
                ? getEstiloBanco(conta.nome, isDark)
                : {
                    bg: isDark ? "#333" : "#E3F2FD",
                    text: isDark ? "#FFF" : "#1976D2",
                  };
              const diaStr = (t.data_vencimento || "0000-00-00").split("-")[2];
              const isTransferencia = t.descricao.includes("[Transf.]");
              const isPendente = t.status === "pendente";

              return (
                <View
                  key={t.id}
                  style={[
                    styles.transactionItem,
                    {
                      backgroundColor: isPendente
                        ? Cores.pendenteBg
                        : Cores.transacaoBg,
                      borderColor: Cores.borda,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dateBox,
                      { backgroundColor: Cores.blocoData },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateBoxDay,
                        { color: Cores.textoPrincipal },
                      ]}
                    >
                      {diaStr}
                    </Text>
                    <Text
                      style={[
                        styles.dateBoxLabel,
                        { color: Cores.textoSecundario },
                      ]}
                    >
                      Dia
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text
                      style={[
                        styles.transactionDesc,
                        {
                          color: isPendente
                            ? Cores.textoSecundario
                            : Cores.textoPrincipal,
                        },
                      ]}
                    >
                      {t.descricao}
                    </Text>
                    <View style={styles.transactionTags}>
                      {isPendente && (
                        <View
                          style={[
                            styles.tagPill,
                            { backgroundColor: isDark ? "#4A1919" : "#FFEBEB" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagText,
                              { color: isDark ? "#FF6B6B" : "#D32F2F" },
                            ]}
                          >
                            Pendente
                          </Text>
                        </View>
                      )}
                      {isTransferencia ? (
                        <View
                          style={[
                            styles.tagPill,
                            { backgroundColor: isDark ? "#4D2C00" : "#FFF3E0" },
                          ]}
                        >
                          <MaterialIcons
                            name="swap-horiz"
                            size={12}
                            color="#F4A261"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.tagText, { color: "#F4A261" }]}>
                            Transferência
                          </Text>
                        </View>
                      ) : categoria ? (
                        <View
                          style={[
                            styles.tagPill,
                            { backgroundColor: isDark ? "#333" : "#F0F0F0" },
                          ]}
                        >
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: categoria.cor },
                            ]}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { color: Cores.textoPrincipal },
                            ]}
                          >
                            {categoria.nome}
                          </Text>
                        </View>
                      ) : null}
                      {conta && (
                        <View
                          style={[
                            styles.tagPill,
                            { backgroundColor: estiloConta.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagText,
                              { color: estiloConta.text },
                            ]}
                          >
                            {conta.nome}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.transactionValue,
                          {
                            color: t.tipo === "receita" ? "#2A9D8F" : "#E76F51",
                          },
                          isPendente && { color: Cores.textoSecundario },
                        ]}
                      >
                        {t.tipo === "receita" ? "+" : "-"} R${" "}
                        {t.valor.toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => alternarStatus(t.id, t.status)}
                      style={styles.actionIcon}
                    >
                      <MaterialIcons
                        name={
                          isPendente ? "radio-button-unchecked" : "check-circle"
                        }
                        size={26}
                        color={isPendente ? Cores.textoSecundario : "#2A9D8F"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deletarTransacao(t.id)}
                      style={styles.actionIcon}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={24}
                        color={Cores.textoSecundario}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAIS DE FILTRO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalFiltroTipo}
        onRequestClose={() => setModalFiltroTipo(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Filtrar por Tipo
            </Text>
            <View style={styles.wrapContainer}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroTipo === "todas" && {
                    backgroundColor: Cores.textoPrincipal,
                  },
                ]}
                onPress={() => setFiltroTipo("todas")}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroTipo === "todas" && { color: Cores.fundo },
                  ]}
                >
                  Mostrar Tudo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroTipo === "receita" && { backgroundColor: "#2A9D8F" },
                ]}
                onPress={() => setFiltroTipo("receita")}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroTipo === "receita" && { color: "#FFF" },
                  ]}
                >
                  Receitas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroTipo === "despesa" && { backgroundColor: "#E76F51" },
                ]}
                onPress={() => setFiltroTipo("despesa")}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroTipo === "despesa" && { color: "#FFF" },
                  ]}
                >
                  Despesas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroTipo === "transferencia" && {
                    backgroundColor: "#F4A261",
                  },
                ]}
                onPress={() => setFiltroTipo("transferencia")}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroTipo === "transferencia" && { color: "#FFF" },
                  ]}
                >
                  Transferências
                </Text>
              </TouchableOpacity>
            </View>
            <Button
              title="Aplicar"
              color={isDark ? "#FFF" : "#1A1A1A"}
              onPress={() => setModalFiltroTipo(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalFiltroConta}
        onRequestClose={() => setModalFiltroConta(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Filtrar por Conta
            </Text>
            <View style={styles.wrapContainer}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroContas.length === 0 && {
                    backgroundColor: Cores.textoPrincipal,
                  },
                ]}
                onPress={() => setFiltroContas([])}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroContas.length === 0 && { color: Cores.fundo },
                  ]}
                >
                  Todas
                </Text>
              </TouchableOpacity>
              {contas.map((c) => (
                <TouchableOpacity
                  key={`fc-${c.id}`}
                  style={[
                    styles.filterPill,
                    { backgroundColor: Cores.pillFundo },
                    filtroContas.includes(c.id) && {
                      backgroundColor: Cores.textoPrincipal,
                    },
                  ]}
                  onPress={() => toggleFiltroConta(c.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: Cores.textoSecundario },
                      filtroContas.includes(c.id) && { color: Cores.fundo },
                    ]}
                  >
                    {c.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              title="Aplicar"
              color="#457B9D"
              onPress={() => setModalFiltroConta(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalFiltroCat}
        onRequestClose={() => setModalFiltroCat(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}
          >
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>
              Filtrar por Categoria
            </Text>
            <View style={styles.wrapContainer}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { backgroundColor: Cores.pillFundo },
                  filtroCategorias.length === 0 && {
                    backgroundColor: Cores.textoPrincipal,
                  },
                ]}
                onPress={() => setFiltroCategorias([])}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: Cores.textoSecundario },
                    filtroCategorias.length === 0 && { color: Cores.fundo },
                  ]}
                >
                  Todas
                </Text>
              </TouchableOpacity>
              {categorias
                .filter((c) => c.ativa !== 0)
                .map((c) => (
                  <TouchableOpacity
                    key={`fcat-${c.id}`}
                    style={[
                      styles.filterPill,
                      { backgroundColor: Cores.pillFundo },
                      filtroCategorias.includes(c.id) && {
                        backgroundColor: Cores.textoPrincipal,
                      },
                    ]}
                    onPress={() => toggleFiltroCategoria(c.id)}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: c.cor, width: 8, height: 8 },
                      ]}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: Cores.textoSecundario },
                        filtroCategorias.includes(c.id) && {
                          color: Cores.fundo,
                        },
                      ]}
                    >
                      {c.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
            <Button
              title="Aplicar"
              color="#2A9D8F"
              onPress={() => setModalFiltroCat(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold" },
  filterButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  mainFilterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  mainFilterText: { marginLeft: 4, fontSize: 13, fontWeight: "bold" },
  mesesScrollContainer: { marginBottom: 15 },
  mesPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  mesPillText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  listContainer: { flex: 1, paddingHorizontal: 20 },
  monthBlock: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  monthHeader: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  monthHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  emptyMonthText: {
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
    fontSize: 13,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  dateBox: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 15,
    minWidth: 45,
  },
  dateBoxDay: { fontSize: 18, fontWeight: "bold" },
  dateBoxLabel: { fontSize: 10, textTransform: "uppercase", marginTop: -2 },
  transactionInfo: { flex: 1 },
  transactionDesc: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  transactionTags: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: { fontSize: 11, fontWeight: "bold" },
  transactionRight: { flexDirection: "row", alignItems: "center" },
  transactionValue: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  actionIcon: { padding: 4, marginLeft: 6 },
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
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
    justifyContent: "center",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  filterPillText: { fontSize: 14, fontWeight: "500" },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});
