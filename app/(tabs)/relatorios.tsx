import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../_layout";

interface Transacao {
  valor: number;
  tipo: string;
  status: string;
  data_vencimento: string;
}

interface Conta {
  id: number;
  saldo_inicial: number;
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const getNomeMes = (mes: string) => MESES_FULL[parseInt(mes, 10) - 1];

const SCREEN_WIDTH = Dimensions.get("window").width;
const BAR_SECTION_WIDTH = Math.max(72, (SCREEN_WIDTH - 40) / 6);
const CHART_HEIGHT = 200;

export default function RelatoriosScreen() {
  const { isDark, session } = useAppTheme();

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333333" : "#EEEEEE",
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
    linhaGuia: isDark ? "#2C2C2C" : "#E0E0E0",
  };

  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  const hoje = new Date();
  const anoAtualNum = hoje.getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtualNum);
  const [mesSelecionado, setMesSelecionado] = useState<string>(
    `${anoAtualNum}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );

  const alterarAno = (direcao: number) => {
    const novoAno = anoSelecionado + direcao;
    setAnoSelecionado(novoAno);
    const mesNum = mesSelecionado.split("-")[1];
    setMesSelecionado(`${novoAno}-${mesNum}`);
    setMesProjSelecionado(novoAno === anoAtualNum ? mesAtualIdx : 0);
  };

  const projScrollRef = useRef<ScrollView>(null);

  const carregarDados = async () => {
    if (!session?.user?.id) return;
    try {
      const resT = await supabase.from("transacoes").select("valor, tipo, status, data_vencimento");
      if (resT.data) setTransacoes(resT.data);
    } catch (error) { console.error(error); }
    try {
      const resC = await supabase.from("contas").select("id, saldo_inicial");
      if (resC.data) setContas(resC.data);
    } catch (error) { console.error(error); }
  };

  useFocusEffect(useCallback(() => { carregarDados(); }, [session]));

  // Resumo do mês selecionado (apenas pagas)
  const transacoesDoMes = transacoes.filter((t) => {
    const dataSegura = t.data_vencimento || new Date().toISOString().split("T")[0];
    return dataSegura.startsWith(mesSelecionado) && t.status === "paga";
  });

  const totalReceitas = transacoesDoMes.filter((t) => t.tipo === "receita").reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalDespesas = transacoesDoMes.filter((t) => t.tipo === "despesa").reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldoFinal = totalReceitas - totalDespesas;

  const mesAtualIdx = hoje.getMonth();

  const mesesDoAno = Array.from({ length: 12 }, (_, i) => `${anoSelecionado}-${String(i + 1).padStart(2, "0")}`);

  // Saldo global acumulado até hoje (baseado em todas as transações pagas)
  const saldoInicialTotal = contas.reduce((acc, c) => acc + Number(c.saldo_inicial), 0);
  const receitasRealizadas = transacoes.filter((t) => t.tipo === "receita" && t.status === "paga").reduce((acc, t) => acc + Number(t.valor), 0);
  const despesasRealizadas = transacoes.filter((t) => t.tipo === "despesa" && t.status === "paga").reduce((acc, t) => acc + Number(t.valor), 0);
  const saldoAtualGlobal = saldoInicialTotal + receitasRealizadas - despesasRealizadas;

  // Projeção para o ano selecionado
  interface MesProjecao {
    mesIdx: number;
    label: string;
    isAtual: boolean;
    receitasRealizadasMes: number;
    despesasRealizadasMes: number;
    receitasPrevistasMes: number;
    despesasPrevistasMes: number;
    saldoAcumulado: number;
  }

  const projecao: MesProjecao[] = [];
  let saldoAcumulado = saldoAtualGlobal;

  // Para anos passados, calcular com base nas transações reais
  // Para o ano atual, projetar a partir do mês atual
  const isAnoAtual = anoSelecionado === anoAtualNum;
  const mesInicio = isAnoAtual ? mesAtualIdx : 0;
  const mesFim = 11;

  // Calcular saldo acumulado até o início da projeção para anos futuros/passados
  if (!isAnoAtual) {
    // Para ano diferente, recalcular com base nas transações do ano
    saldoAcumulado = saldoInicialTotal;
    // Somar todas as transações pagas ANTES do ano selecionado
    transacoes
      .filter((t) => t.status === "paga" && (t.data_vencimento || "").substring(0, 4) < String(anoSelecionado))
      .forEach((t) => { saldoAcumulado += t.tipo === "receita" ? Number(t.valor) : -Number(t.valor); });
  }

  for (let m = mesInicio; m <= mesFim; m++) {
    const yyyymm = `${anoSelecionado}-${String(m + 1).padStart(2, "0")}`;
    const isAtual = isAnoAtual && m === mesAtualIdx;

    const transDoMes = transacoes.filter((t) => (t.data_vencimento || "").startsWith(yyyymm));
    const recPagas = transDoMes.filter((t) => t.tipo === "receita" && t.status === "paga").reduce((acc, t) => acc + Number(t.valor), 0);
    const despPagas = transDoMes.filter((t) => t.tipo === "despesa" && t.status === "paga").reduce((acc, t) => acc + Number(t.valor), 0);
    const recPendentes = transDoMes.filter((t) => t.tipo === "receita" && t.status !== "paga").reduce((acc, t) => acc + Number(t.valor), 0);
    const despPendentes = transDoMes.filter((t) => t.tipo === "despesa" && t.status !== "paga").reduce((acc, t) => acc + Number(t.valor), 0);

    if (isAtual) {
      saldoAcumulado = saldoAtualGlobal + recPendentes - despPendentes;
    } else if (isAnoAtual && m < mesAtualIdx) {
      // Meses passados do ano atual — já incluídos no saldoAtualGlobal
      saldoAcumulado = saldoAtualGlobal;
    } else {
      saldoAcumulado += recPagas + recPendentes - despPagas - despPendentes;
    }

    projecao.push({
      mesIdx: m,
      label: MESES_ABREV[m],
      isAtual,
      receitasRealizadasMes: recPagas,
      despesasRealizadasMes: despPagas,
      receitasPrevistasMes: recPendentes,
      despesasPrevistasMes: despPendentes,
      saldoAcumulado,
    });
  }

  const saldos = projecao.map((p) => p.saldoAcumulado);
  const saldoMax = Math.max(...saldos, saldoAtualGlobal, 0);
  const saldoMin = Math.min(...saldos, saldoAtualGlobal, 0);
  const range = saldoMax - saldoMin || 1;

  const getY = (valor: number) => CHART_HEIGHT - ((valor - saldoMin) / range) * CHART_HEIGHT;
  const zeroY = getY(0);

  const pontos = [
    { x: BAR_SECTION_WIDTH / 2, y: getY(saldoAtualGlobal) },
    ...projecao.map((p, i) => ({ x: BAR_SECTION_WIDTH * i + BAR_SECTION_WIDTH / 2, y: getY(p.saldoAcumulado) })),
  ];

  const formatVal = (v: number) => Math.abs(v) >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;

  const [mesProjSelecionado, setMesProjSelecionado] = useState<number>(mesAtualIdx);
  const projDetalhe = projecao.find((p) => p.mesIdx === mesProjSelecionado) ?? projecao[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>Fluxo de Caixa</Text>
        <Text style={[styles.subtitle, { color: Cores.textoSecundario }]}>
          Análise de {getNomeMes(mesSelecionado.split("-")[1])} {anoSelecionado}
        </Text>
      </View>

      {/* NAVEGADOR DE ANO */}
      <View style={[styles.anoNavBar, { backgroundColor: Cores.pillFundo }]}>
        <TouchableOpacity onPress={() => alterarAno(-1)} style={styles.anoNavBtn}>
          <MaterialIcons name="chevron-left" size={28} color={Cores.textoPrincipal} />
        </TouchableOpacity>
        <Text style={[styles.anoNavText, { color: Cores.textoPrincipal }]}>{anoSelecionado}</Text>
        <TouchableOpacity onPress={() => alterarAno(1)} style={styles.anoNavBtn}>
          <MaterialIcons name="chevron-right" size={28} color={Cores.textoPrincipal} />
        </TouchableOpacity>
      </View>

      {/* SELETOR DE MÊS */}
      <View style={styles.mesesScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {mesesDoAno.map((yyyymm) => {
            const isAtivo = mesSelecionado === yyyymm;
            return (
              <TouchableOpacity
                key={yyyymm}
                style={[styles.mesPill, { backgroundColor: isAtivo ? Cores.textoPrincipal : Cores.pillFundo, borderColor: isAtivo ? Cores.textoPrincipal : Cores.borda }]}
                onPress={() => setMesSelecionado(yyyymm)}
              >
                <Text style={[styles.mesPillText, { color: isAtivo ? Cores.fundo : Cores.textoSecundario }]}>
                  {getNomeMes(yyyymm.split("-")[1])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resumo do mês */}
        <View style={[styles.summaryCard, { backgroundColor: Cores.cardFundo, borderColor: Cores.borda }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}><MaterialIcons name="arrow-upward" size={20} color="#2A9D8F" /></View>
              <Text style={[styles.summaryLabel, { color: Cores.textoSecundario }]}>Receitas</Text>
              <Text style={[styles.summaryValue, { color: "#2A9D8F" }]}>R$ {totalReceitas.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}><MaterialIcons name="arrow-downward" size={20} color="#E76F51" /></View>
              <Text style={[styles.summaryLabel, { color: Cores.textoSecundario }]}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: "#E76F51" }]}>R$ {totalDespesas.toFixed(2)}</Text>
            </View>
          </View>
          <View style={[styles.resultBox, { backgroundColor: isDark ? "#2C2C2C" : "#EEEEEE" }]}>
            <Text style={[styles.resultLabel, { color: Cores.textoSecundario }]}>Saldo do Mês</Text>
            <Text style={[styles.resultAmount, { color: saldoFinal >= 0 ? "#2A9D8F" : "#E76F51" }]}>
              {saldoFinal >= 0 ? "+" : "-"} R$ {Math.abs(saldoFinal).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Gráfico de projeção */}
        <View style={[styles.chartCard, { backgroundColor: Cores.cardFundo, borderColor: Cores.borda }]}>
          <View style={styles.chartHeader}>
            <MaterialIcons name="show-chart" size={18} color="#2A9D8F" />
            <Text style={[styles.chartTitle, { color: Cores.textoPrincipal }]}>
              Projeção de Saldo — {anoSelecionado}
            </Text>
          </View>
          <Text style={[styles.chartSubtitle, { color: Cores.textoSecundario }]}>
            Toque em um mês para ver o detalhamento
          </Text>

          {projecao.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <Text style={{ color: Cores.textoSecundario, fontStyle: "italic" }}>Sem dados para projeção.</Text>
            </View>
          ) : (
            <ScrollView ref={projScrollRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 8 }}>
              <View style={{ width: BAR_SECTION_WIDTH * projecao.length, height: CHART_HEIGHT + 30 }}>
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const val = saldoMin + frac * range;
                  const y = getY(val);
                  return <View key={frac} style={{ position: "absolute", top: y, left: 0, right: 0, height: 1, backgroundColor: Cores.linhaGuia }} />;
                })}

                {saldoMin < 0 && (
                  <View style={{ position: "absolute", top: zeroY, left: 0, right: 0, height: 1.5, backgroundColor: "#E76F51", opacity: 0.5 }} />
                )}

                {pontos.slice(0, -1).map((p, i) => {
                  const p2 = pontos[i + 1];
                  const dx = p2.x - p.x;
                  const dy = p2.y - p.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const isFuture = projecao[i] && !projecao[i].isAtual;
                  return (
                    <View key={i} style={{ position: "absolute", left: p.x, top: p.y, width: length, height: 2, backgroundColor: isFuture ? "#457B9D" : "#2A9D8F", opacity: isFuture ? 0.6 : 1, transform: [{ rotate: `${angle}deg` }], transformOrigin: "0 0" }} />
                  );
                })}

                {projecao.map((p, i) => {
                  const py = pontos[i + 1]?.y ?? getY(p.saldoAcumulado);
                  const isSelected = mesProjSelecionado === p.mesIdx;
                  const cor = p.saldoAcumulado >= 0 ? "#2A9D8F" : "#E76F51";
                  return (
                    <TouchableOpacity key={p.mesIdx} activeOpacity={0.7} onPress={() => setMesProjSelecionado(p.mesIdx)}
                      style={{ position: "absolute", left: BAR_SECTION_WIDTH * i, top: 0, width: BAR_SECTION_WIDTH, height: CHART_HEIGHT + 30, alignItems: "center" }}>
                      {isSelected && (
                        <View style={{ position: "absolute", top: 0, left: 4, right: 4, bottom: 0, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderRadius: 8 }} />
                      )}
                      <View style={{ position: "absolute", top: py - (isSelected ? 7 : 5), width: isSelected ? 14 : 10, height: isSelected ? 14 : 10, borderRadius: isSelected ? 7 : 5, backgroundColor: cor, borderWidth: isSelected ? 2 : 0, borderColor: Cores.fundo, elevation: isSelected ? 3 : 0 }} />
                      {isSelected && (
                        <View style={{ position: "absolute", top: py < 30 ? py + 14 : py - 24, backgroundColor: cor, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "bold" }}>{formatVal(p.saldoAcumulado)}</Text>
                        </View>
                      )}
                      <Text style={{ position: "absolute", bottom: 0, fontSize: 11, fontWeight: isSelected ? "bold" : "500", color: isSelected ? Cores.textoPrincipal : Cores.textoSecundario }}>
                        {p.label}{p.isAtual ? " ●" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {projDetalhe && (
            <View style={[styles.detalheBox, { borderColor: Cores.borda, backgroundColor: isDark ? "#242424" : "#F8F9FA" }]}>
              <Text style={[styles.detalhetitulo, { color: Cores.textoPrincipal }]}>
                {MESES_ABREV[projDetalhe.mesIdx]} {anoSelecionado}{projDetalhe.isAtual ? "  •  Mês atual" : ""}
              </Text>

              {projDetalhe.isAtual ? (
                <>
                  <DetalheRow label="Recebido" valor={`+ R$ ${projDetalhe.receitasRealizadasMes.toFixed(2)}`} cor="#2A9D8F" dotCor="#2A9D8F" cores={Cores} />
                  <DetalheRow label="Pago" valor={`- R$ ${projDetalhe.despesasRealizadasMes.toFixed(2)}`} cor="#E76F51" dotCor="#E76F51" cores={Cores} />
                  <View style={[styles.detalheSep, { backgroundColor: Cores.borda }]} />
                  <DetalheRow label="A receber" valor={`+ R$ ${projDetalhe.receitasPrevistasMes.toFixed(2)}`} cor="#457B9D" dotCor="#457B9D" cores={Cores} />
                  <DetalheRow label="A pagar" valor={`- R$ ${projDetalhe.despesasPrevistasMes.toFixed(2)}`} cor="#E9C46A" dotCor="#E9C46A" cores={Cores} />
                  <View style={[styles.detalheSep, { backgroundColor: Cores.borda }]} />
                  <DetalheRow label="Saldo atual" valor={`R$ ${saldoAtualGlobal.toFixed(2)}`} cor={saldoAtualGlobal >= 0 ? "#2A9D8F" : "#E76F51"} isIcon cores={Cores} />
                  <DetalheRow label="Saldo previsto" valor={`R$ ${projDetalhe.saldoAcumulado.toFixed(2)}`} cor={projDetalhe.saldoAcumulado >= 0 ? "#2A9D8F" : "#E76F51"} isIcon cores={Cores} bold />
                </>
              ) : (
                <>
                  <DetalheRow label="A receber" valor={`+ R$ ${projDetalhe.receitasPrevistasMes.toFixed(2)}`} cor="#457B9D" dotCor="#457B9D" cores={Cores} />
                  <DetalheRow label="A pagar" valor={`- R$ ${projDetalhe.despesasPrevistasMes.toFixed(2)}`} cor="#E9C46A" dotCor="#E9C46A" cores={Cores} />
                  <View style={[styles.detalheSep, { backgroundColor: Cores.borda }]} />
                  <DetalheRow label="Saldo previsto" valor={`R$ ${projDetalhe.saldoAcumulado.toFixed(2)}`} cor={projDetalhe.saldoAcumulado >= 0 ? "#2A9D8F" : "#E76F51"} isIcon cores={Cores} bold />
                </>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Componente auxiliar para linha do detalhe
function DetalheRow({ label, valor, cor, dotCor, isIcon, bold, cores }: {
  label: string; valor: string; cor: string; dotCor?: string; isIcon?: boolean; bold?: boolean; cores: any;
}) {
  return (
    <View style={styles.detalheRow}>
      {isIcon ? (
        <MaterialIcons name={label === "Saldo atual" ? "account-balance-wallet" : "trending-up"} size={12} color={cores.textoSecundario} style={{ marginRight: 8 }} />
      ) : (
        <View style={[styles.detalheDot, { backgroundColor: dotCor }]} />
      )}
      <Text style={[styles.detalheLabel, { color: cores.textoSecundario }]}>{label}</Text>
      <Text style={[styles.detalheVal, { color: cor, fontWeight: bold ? "bold" : "600" }]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginTop: 4 },

  anoNavBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 15, marginBottom: 8, borderRadius: 12, paddingVertical: 4 },
  anoNavBtn: { padding: 8 },
  anoNavText: { fontSize: 18, fontWeight: "bold", minWidth: 60, textAlign: "center" },

  mesesScrollContainer: { marginBottom: 15 },
  mesPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  mesPillText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },

  content: { flex: 1, paddingHorizontal: 20 },
  summaryCard: { padding: 20, borderRadius: 16, borderWidth: 1, elevation: 2, marginBottom: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  summaryItem: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: "80%", backgroundColor: "#DDD", marginHorizontal: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.05)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  summaryLabel: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "bold" },
  resultBox: { alignItems: "center", padding: 15, borderRadius: 12 },
  resultLabel: { fontSize: 14, fontWeight: "600", textTransform: "uppercase", marginBottom: 5 },
  resultAmount: { fontSize: 28, fontWeight: "bold" },

  chartCard: { padding: 20, borderRadius: 16, borderWidth: 1, elevation: 2, marginBottom: 20 },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartTitle: { fontSize: 16, fontWeight: "bold" },
  chartSubtitle: { fontSize: 12, marginTop: 4 },

  detalheBox: { marginTop: 16, borderRadius: 12, borderWidth: 1, padding: 14 },
  detalhetitulo: { fontSize: 13, fontWeight: "bold", marginBottom: 10 },
  detalheRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  detalheDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  detalheLabel: { flex: 1, fontSize: 13 },
  detalheVal: { fontSize: 13, fontWeight: "600" },
  detalheSep: { height: 1, marginVertical: 8 },
});
