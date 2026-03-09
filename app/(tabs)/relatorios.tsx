import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase"; // <-- NOSSO CABO DA NUVEM
import { useAppTheme } from "../_layout";

interface Transacao {
  valor: number;
  tipo: string;
  status: string;
  data_vencimento: string;
}

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

export default function RelatoriosScreen() {
  const { isDark, session } = useAppTheme();

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333333" : "#EEEEEE",
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
  };

  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtualStr);

  const carregarDados = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from("transacoes")
        .select("valor, tipo, status, data_vencimento");
      if (data) setTransacoes(data);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [session]),
  );

  const transacoesDoMes = transacoes.filter((t) => {
    const dataSegura =
      t.data_vencimento || new Date().toISOString().split("T")[0];
    return dataSegura.startsWith(mesSelecionado) && t.status === "paga";
  });

  const totalReceitas = transacoesDoMes
    .filter((t) => t.tipo === "receita")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalDespesas = transacoesDoMes
    .filter((t) => t.tipo === "despesa")
    .reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldoFinal = totalReceitas - totalDespesas;

  const anoAtual = new Date().getFullYear();
  const mesesDoAno = Array.from(
    { length: 12 },
    (_, i) => `${anoAtual}-${String(i + 1).padStart(2, "0")}`,
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>
          Fluxo de Caixa
        </Text>
        <Text style={[styles.subtitle, { color: Cores.textoSecundario }]}>
          Análise do mês de {getNomeMes(mesSelecionado.split("-")[1])}
        </Text>
      </View>

      <View style={styles.mesesScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        >
          {mesesDoAno.map((yyyymm) => {
            const isAtivo = mesSelecionado === yyyymm;
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
                  {getNomeMes(yyyymm.split("-")[1])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: Cores.cardFundo, borderColor: Cores.borda },
          ]}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="arrow-upward" size={20} color="#2A9D8F" />
              </View>
              <Text
                style={[styles.summaryLabel, { color: Cores.textoSecundario }]}
              >
                Receitas
              </Text>
              <Text style={[styles.summaryValue, { color: "#2A9D8F" }]}>
                R$ {totalReceitas.toFixed(2)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <MaterialIcons
                  name="arrow-downward"
                  size={20}
                  color="#E76F51"
                />
              </View>
              <Text
                style={[styles.summaryLabel, { color: Cores.textoSecundario }]}
              >
                Despesas
              </Text>
              <Text style={[styles.summaryValue, { color: "#E76F51" }]}>
                R$ {totalDespesas.toFixed(2)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.resultBox,
              { backgroundColor: isDark ? "#2C2C2C" : "#EEEEEE" },
            ]}
          >
            <Text
              style={[styles.resultLabel, { color: Cores.textoSecundario }]}
            >
              Saldo do Mês
            </Text>
            <Text
              style={[
                styles.resultAmount,
                { color: saldoFinal >= 0 ? "#2A9D8F" : "#E76F51" },
              ]}
            >
              {saldoFinal >= 0 ? "+" : "-"} R$ {Math.abs(saldoFinal).toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 15 },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginTop: 4 },
  mesesScrollContainer: { marginBottom: 20 },
  mesPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  mesPillText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  content: { flex: 1, paddingHorizontal: 20 },
  summaryCard: { padding: 20, borderRadius: 16, borderWidth: 1, elevation: 2 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  divider: {
    width: 1,
    height: "80%",
    backgroundColor: "#DDD",
    marginHorizontal: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "bold" },
  resultBox: { alignItems: "center", padding: 15, borderRadius: 12 },
  resultLabel: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  resultAmount: { fontSize: 28, fontWeight: "bold" },
});
