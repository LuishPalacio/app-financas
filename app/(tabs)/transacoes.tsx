import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
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
  if (n.includes("nu") || n.includes("nubank")) return { bg: "#8A05BE", text: "#FFF" };
  if (n.includes("itaú") || n.includes("itau")) return { bg: "#EC7000", text: "#FFF" };
  if (n.includes("inter")) return { bg: "#FF7A00", text: "#FFF" };
  if (n.includes("bradesco")) return { bg: "#CC092F", text: "#FFF" };
  if (n.includes("brasil") || n.includes("bb")) return { bg: "#F9D300", text: "#0038A8" };
  if (n.includes("santander")) return { bg: "#EC0000", text: "#FFF" };
  if (n.includes("caixa")) return { bg: "#005CA9", text: "#FFF" };
  if (n.includes("c6")) return { bg: "#242424", text: "#FFF" };
  if (n.includes("carteira") || n.includes("dinheiro")) return { bg: "#2A9D8F", text: "#FFF" };
  return { bg: isDark ? "#333" : "#E3F2FD", text: isDark ? "#FFF" : "#1976D2" };
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const getNomeMes = (mes: string) => MESES[parseInt(mes, 10) - 1];

const formatarMesAno = (yyyymm: string) => {
  if (!yyyymm) return "";
  const [ano, mes] = yyyymm.split("-");
  return `${getNomeMes(mes)} ${ano}`;
};

export default function TransacoesScreen() {
  const { isDark, session } = useAppTheme();

  const Cores = {
    fundo: isDark ? "#121212" : "#F5F7FA",
    textoPrincipal: isDark ? "#ffffff" : "#1A1A1A",
    textoSecundario: isDark ? "#AAAAAA" : "#666666",
    cardFundo: isDark ? "#1E1E1E" : "#ffffff",
    blocoData: isDark ? "#2C2C2C" : "#F0F0F0",
    borda: isDark ? "#333333" : "#EEEEEE",
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
    headerTabela: isDark ? "#252525" : "#F0F4F8",
    rowPar: isDark ? "#161616" : "#FAFAFA",
    rowImpar: isDark ? "#1C1C1C" : "#FFFFFF",
  };

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  const [filtroContas, setFiltroContas] = useState<number[]>([]);
  const [filtroCategorias, setFiltroCategorias] = useState<number[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "receita" | "despesa" | "transferencia">("todas");

  const [modalFiltroConta, setModalFiltroConta] = useState(false);
  const [modalFiltroCat, setModalFiltroCat] = useState(false);
  const [modalFiltroTipo, setModalFiltroTipo] = useState(false);

  const hoje = new Date();
  const anoAtualNum = hoje.getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtualNum);
  const [mesSelecionado, setMesSelecionado] = useState<string>(
    `${anoAtualNum}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );

  // Anos: 3 atrás até 2 à frente
  const anosDisponiveis = Array.from({ length: 6 }, (_, i) => anoAtualNum - 3 + i);

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

  useFocusEffect(useCallback(() => { carregarDados(); }, [session]));

  const deletarTransacao = async (id: number) => {
    Alert.alert("Excluir", "Tem certeza que deseja apagar esta transação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          const transacao = transacoes.find((t) => t.id === id);
          const { error } = await supabase.from("transacoes").delete().eq("id", id);
          if (error) { Alert.alert("Erro", "Não foi possível apagar a transação."); return; }

          if (transacao) {
            const descricao = transacao.descricao ?? "";
            let nomeCaixinha: string | null = null;
            let operacao: "reverter_guardar" | "reverter_resgatar" | null = null;

            if (descricao.startsWith("Guardar em: ")) { nomeCaixinha = descricao.replace("Guardar em: ", "").trim(); operacao = "reverter_guardar"; }
            else if (descricao.startsWith("Resgate de: ")) { nomeCaixinha = descricao.replace("Resgate de: ", "").trim(); operacao = "reverter_resgatar"; }

            if (nomeCaixinha && operacao) {
              const { data: caixinhaData } = await supabase.from("caixinhas").select("id, saldo_atual").ilike("nome", nomeCaixinha).single();
              if (caixinhaData) {
                const novoSaldo = operacao === "reverter_guardar"
                  ? Math.max(0, Number(caixinhaData.saldo_atual) - Number(transacao.valor))
                  : Number(caixinhaData.saldo_atual) + Number(transacao.valor);
                await supabase.from("caixinhas").update({ saldo_atual: novoSaldo }).eq("id", caixinhaData.id);
              }
            }
          }
          carregarDados();
        },
      },
    ]);
  };

  const alternarStatus = async (id: number, statusAtual: string) => {
    const novoStatus = statusAtual === "paga" ? "pendente" : "paga";
    const { error } = await supabase.from("transacoes").update({ status: novoStatus }).eq("id", id);
    if (error) Alert.alert("Erro", "Não foi possível atualizar o estado.");
    else carregarDados();
  };

  const toggleFiltroConta = (id: number) =>
    setFiltroContas((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  const toggleFiltroCategoria = (id: number) =>
    setFiltroCategorias((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const transacoesDoMes = transacoes
    .filter((t) => {
      const passaConta = filtroContas.length === 0 || filtroContas.includes(t.conta_id);
      const passaCategoria = filtroCategorias.length === 0 || (t.categoria_id !== null && filtroCategorias.includes(t.categoria_id));
      const dataSegura = t.data_vencimento || new Date().toISOString().split("T")[0];
      const passaMes = dataSegura.startsWith(mesSelecionado);
      const isTransferencia = t.descricao.includes("[Transf.]");
      let passaTipo = true;
      if (filtroTipo === "transferencia") passaTipo = isTransferencia;
      else if (filtroTipo === "receita") passaTipo = t.tipo === "receita" && !isTransferencia;
      else if (filtroTipo === "despesa") passaTipo = t.tipo === "despesa" && !isTransferencia;
      return passaConta && passaCategoria && passaMes && passaTipo;
    })
    .sort((a, b) => (b.data_vencimento || "").localeCompare(a.data_vencimento || ""));

  const totalReceitas = transacoesDoMes
    .filter((t) => t.tipo === "receita" && !t.descricao.includes("[Transf.]"))
    .reduce((acc, t) => acc + t.valor, 0);
  const totalDespesas = transacoesDoMes
    .filter((t) => t.tipo === "despesa" && !t.descricao.includes("[Transf.]"))
    .reduce((acc, t) => acc + t.valor, 0);

  const mesesDoAno = Array.from({ length: 12 }, (_, i) => `${anoSelecionado}-${String(i + 1).padStart(2, "0")}`);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      {/* CABEÇALHO */}
      <View style={[styles.header, { backgroundColor: Cores.fundo }]}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>Extrato</Text>
      </View>

      {/* SELETOR DE ANO */}
      <View style={styles.anosScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {anosDisponiveis.map((ano) => {
            const isAtivo = anoSelecionado === ano;
            return (
              <TouchableOpacity
                key={ano}
                style={[styles.anoPill, { backgroundColor: isAtivo ? "#2A9D8F" : Cores.pillFundo, borderColor: isAtivo ? "#2A9D8F" : Cores.borda }]}
                onPress={() => {
                  setAnoSelecionado(ano);
                  // Mantém o mês atual ao trocar de ano — CORRRIGIDO
                  const mesNum = mesSelecionado.split("-")[1];
                  setMesSelecionado(`${ano}-${mesNum}`);
                }}
              >
                <Text style={[styles.anoPillText, { color: isAtivo ? "#FFF" : Cores.textoSecundario }]}>{ano}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* FILTROS */}
      <View style={styles.filterButtonsRow}>
        <TouchableOpacity style={[styles.mainFilterButton, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalFiltroTipo(true)}>
          <MaterialIcons name="swap-vert" size={18} color={filtroTipo !== "todas" ? "#F4A261" : Cores.textoSecundario} />
          <Text style={[styles.mainFilterText, { color: filtroTipo !== "todas" ? "#F4A261" : Cores.textoSecundario }]} numberOfLines={1}>
            {filtroTipo === "todas" ? "Tipo" : filtroTipo === "receita" ? "Receitas" : filtroTipo === "despesa" ? "Despesas" : "Transf."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainFilterButton, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalFiltroConta(true)}>
          <MaterialIcons name="account-balance-wallet" size={18} color={filtroContas.length > 0 ? "#457B9D" : Cores.textoSecundario} />
          <Text style={[styles.mainFilterText, { color: filtroContas.length > 0 ? "#457B9D" : Cores.textoSecundario }]} numberOfLines={1}>
            Contas {filtroContas.length > 0 ? `(${filtroContas.length})` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainFilterButton, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalFiltroCat(true)}>
          <MaterialIcons name="label" size={18} color={filtroCategorias.length > 0 ? "#2A9D8F" : Cores.textoSecundario} />
          <Text style={[styles.mainFilterText, { color: filtroCategorias.length > 0 ? "#2A9D8F" : Cores.textoSecundario }]} numberOfLines={1}>
            Categ. {filtroCategorias.length > 0 ? `(${filtroCategorias.length})` : ""}
          </Text>
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
                  {getNomeMes(yyyymm.split("-")[1])?.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* RESUMO RÁPIDO DO MÊS */}
      <View style={[styles.resumoBar, { backgroundColor: Cores.cardFundo, borderBottomColor: Cores.borda }]}>
        <View style={styles.resumoItem}>
          <MaterialIcons name="arrow-upward" size={14} color="#2A9D8F" />
          <Text style={styles.resumoReceita}>R$ {totalReceitas.toFixed(2)}</Text>
        </View>
        <View style={[styles.resumoDivider, { backgroundColor: Cores.borda }]} />
        <View style={styles.resumoItem}>
          <MaterialIcons name="arrow-downward" size={14} color="#E76F51" />
          <Text style={styles.resumoDespesa}>R$ {totalDespesas.toFixed(2)}</Text>
        </View>
        <View style={[styles.resumoDivider, { backgroundColor: Cores.borda }]} />
        <View style={styles.resumoItem}>
          <MaterialIcons name="account-balance" size={14} color={totalReceitas - totalDespesas >= 0 ? "#2A9D8F" : "#E76F51"} />
          <Text style={[styles.resumoBalanco, { color: totalReceitas - totalDespesas >= 0 ? "#2A9D8F" : "#E76F51" }]}>
            R$ {(totalReceitas - totalDespesas).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* LISTA DE TRANSAÇÕES */}
      <ScrollView style={styles.listContainer}>
        <View style={[styles.tabelaCard, { backgroundColor: Cores.cardFundo, borderColor: Cores.borda }]}>
          {/* Cabeçalho do mês */}
          <View style={[styles.monthHeader, { backgroundColor: isDark ? "#252525" : "#F8F9FA", borderColor: Cores.borda }]}>
            <Text style={[styles.monthHeaderText, { color: Cores.textoPrincipal }]}>
              {formatarMesAno(mesSelecionado)}
            </Text>
            {transacoesDoMes.length > 0 && (
              <Text style={[styles.contadorText, { color: Cores.textoSecundario }]}>
                {transacoesDoMes.length} registro{transacoesDoMes.length !== 1 ? "s" : ""}
              </Text>
            )}
          </View>

          {transacoesDoMes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={36} color={Cores.textoSecundario} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyMonthText, { color: Cores.textoSecundario }]}>
                Nenhum registro encontrado com estes filtros.
              </Text>
            </View>
          ) : (
            transacoesDoMes.map((t, index) => {
              const conta = contas.find((c) => c.id === t.conta_id);
              const categoria = categorias.find((c) => c.id === t.categoria_id);
              const estiloConta = conta ? getEstiloBanco(conta.nome, isDark) : { bg: isDark ? "#333" : "#E3F2FD", text: isDark ? "#FFF" : "#1976D2" };
              const partes = (t.data_vencimento || "0000-00-00").split("-");
              const isPendente = t.status === "pendente";
              const isTransferencia = t.descricao.includes("[Transf.]");
              const corValor = isTransferencia ? "#F4A261" : t.tipo === "receita" ? "#2A9D8F" : "#E76F51";
              const prefixoValor = t.tipo === "receita" ? "+" : "-";
              const bgRow = index % 2 === 0 ? Cores.rowImpar : Cores.rowPar;

              return (
                <View
                  key={t.id}
                  style={[styles.transacaoCard, {
                    backgroundColor: isPendente ? (isDark ? "#1A1200" : "#FFFDE7") : bgRow,
                    borderBottomColor: Cores.borda,
                  }]}
                >
                  {/* Coluna esquerda: data */}
                  <View style={[styles.dataBadge, { backgroundColor: Cores.blocoData }]}>
                    <Text style={[styles.dataDia, { color: Cores.textoPrincipal }]}>{partes[2]}</Text>
                    <Text style={[styles.dataMes, { color: Cores.textoSecundario }]}>
                      {getNomeMes(partes[1])?.substring(0, 3).toUpperCase()}
                    </Text>
                  </View>

                  {/* Coluna central: descrição + badges */}
                  <View style={styles.transacaoInfo}>
                    <Text style={[styles.nomeText, { color: isPendente ? Cores.textoSecundario : Cores.textoPrincipal }]} numberOfLines={2}>
                      {t.descricao}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {/* Badge conta */}
                      {conta && (
                        <View style={[styles.badge, { backgroundColor: estiloConta.bg }]}>
                          <Text style={[styles.badgeText, { color: estiloConta.text }]} numberOfLines={1}>{conta.nome}</Text>
                        </View>
                      )}
                      {/* Badge categoria */}
                      {categoria && (
                        <View style={[styles.badge, { backgroundColor: categoria.cor + "33" }]}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: categoria.cor, marginRight: 4 }} />
                          <Text style={[styles.badgeText, { color: categoria.cor }]} numberOfLines={1}>{categoria.nome}</Text>
                        </View>
                      )}
                      {isPendente && (
                        <View style={styles.pendentePill}>
                          <Text style={styles.pendenteText}>Pendente</Text>
                        </View>
                      )}
                      {isTransferencia && (
                        <View style={styles.transferPill}>
                          <MaterialIcons name="swap-horiz" size={9} color="#F4A261" />
                          <Text style={styles.transferText}>Transf.</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Coluna direita: valor + ações */}
                  <View style={styles.transacaoAcoes}>
                    <Text style={[styles.valorText, { color: isPendente ? Cores.textoSecundario : corValor }]} numberOfLines={1} adjustsFontSizeToFit>
                      {prefixoValor} R${t.valor.toFixed(2)}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
                      <TouchableOpacity onPress={() => alternarStatus(t.id, t.status)} style={styles.acaoBtn}>
                        <MaterialIcons
                          name={isPendente ? "radio-button-unchecked" : "check-circle"}
                          size={22}
                          color={isPendente ? Cores.textoSecundario : "#2A9D8F"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deletarTransacao(t.id)} style={styles.acaoBtn}>
                        <MaterialIcons name="delete-outline" size={22} color={isDark ? "#FF6B6B" : "#D32F2F"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* Rodapé */}
          {transacoesDoMes.length > 0 && (
            <View style={[styles.tabelaFooter, { backgroundColor: Cores.headerTabela, borderColor: Cores.borda }]}>
              <Text style={[styles.footerLabel, { color: Cores.textoSecundario }]}>Total do mês</Text>
              <View style={styles.footerTotais}>
                <View style={styles.footerItem}>
                  <MaterialIcons name="arrow-upward" size={12} color="#2A9D8F" />
                  <Text style={styles.footerValorReceita}>R$ {totalReceitas.toFixed(2)}</Text>
                </View>
                <View style={styles.footerItem}>
                  <MaterialIcons name="arrow-downward" size={12} color="#E76F51" />
                  <Text style={styles.footerValorDespesa}>R$ {totalDespesas.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAIS DE FILTRO */}
      <Modal animationType="fade" transparent visible={modalFiltroTipo} onRequestClose={() => setModalFiltroTipo(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>Filtrar por Tipo</Text>
            <View style={styles.wrapContainer}>
              {[
                { key: "todas" as const, label: "Mostrar Tudo", bgAtivo: "#457B9D" },
                { key: "receita" as const, label: "Receitas", bgAtivo: "#2A9D8F" },
                { key: "despesa" as const, label: "Despesas", bgAtivo: "#E76F51" },
                { key: "transferencia" as const, label: "Transferências", bgAtivo: "#F4A261" },
              ].map((op) => {
                const isAtivo = filtroTipo === op.key;
                return (
                  <TouchableOpacity key={op.key} style={[styles.filterPill, { backgroundColor: isAtivo ? op.bgAtivo : Cores.pillFundo, borderWidth: 1, borderColor: isAtivo ? op.bgAtivo : Cores.borda }]} onPress={() => setFiltroTipo(op.key)}>
                    <Text style={[styles.filterPillText, { color: isAtivo ? "#FFF" : Cores.textoPrincipal }]}>{op.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.modalBotaoAplicar, { backgroundColor: "#2A9D8F" }]} onPress={() => setModalFiltroTipo(false)}>
              <Text style={styles.modalBotaoTexto}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={modalFiltroConta} onRequestClose={() => setModalFiltroConta(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>Filtrar por Conta</Text>
            <View style={styles.wrapContainer}>
              <TouchableOpacity style={[styles.filterPill, { backgroundColor: filtroContas.length === 0 ? "#457B9D" : Cores.pillFundo, borderWidth: 1, borderColor: filtroContas.length === 0 ? "#457B9D" : Cores.borda }]} onPress={() => setFiltroContas([])}>
                <Text style={[styles.filterPillText, { color: filtroContas.length === 0 ? "#FFF" : Cores.textoPrincipal }]}>Todas</Text>
              </TouchableOpacity>
              {contas.map((c) => (
                <TouchableOpacity key={`fc-${c.id}`} style={[styles.filterPill, { backgroundColor: filtroContas.includes(c.id) ? "#457B9D" : Cores.pillFundo, borderWidth: 1, borderColor: filtroContas.includes(c.id) ? "#457B9D" : Cores.borda }]} onPress={() => toggleFiltroConta(c.id)}>
                  <Text style={[styles.filterPillText, { color: filtroContas.includes(c.id) ? "#FFF" : Cores.textoPrincipal }]}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.modalBotaoAplicar, { backgroundColor: "#457B9D" }]} onPress={() => setModalFiltroConta(false)}>
              <Text style={styles.modalBotaoTexto}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={modalFiltroCat} onRequestClose={() => setModalFiltroCat(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
            <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>Filtrar por Categoria</Text>
            <View style={styles.wrapContainer}>
              <TouchableOpacity style={[styles.filterPill, { backgroundColor: filtroCategorias.length === 0 ? "#2A9D8F" : Cores.pillFundo, borderWidth: 1, borderColor: filtroCategorias.length === 0 ? "#2A9D8F" : Cores.borda }]} onPress={() => setFiltroCategorias([])}>
                <Text style={[styles.filterPillText, { color: filtroCategorias.length === 0 ? "#FFF" : Cores.textoPrincipal }]}>Todas</Text>
              </TouchableOpacity>
              {categorias.filter((c) => c.ativa !== 0).map((c) => (
                <TouchableOpacity key={`fcat-${c.id}`} style={[styles.filterPill, { backgroundColor: filtroCategorias.includes(c.id) ? c.cor : Cores.pillFundo, borderWidth: 1, borderColor: filtroCategorias.includes(c.id) ? c.cor : Cores.borda }]} onPress={() => toggleFiltroCategoria(c.id)}>
                  <View style={[styles.colorDot, { backgroundColor: filtroCategorias.includes(c.id) ? "#FFF" : c.cor }]} />
                  <Text style={[styles.filterPillText, { color: filtroCategorias.includes(c.id) ? "#FFF" : Cores.textoPrincipal }]}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.modalBotaoAplicar, { backgroundColor: "#2A9D8F" }]} onPress={() => setModalFiltroCat(false)}>
              <Text style={styles.modalBotaoTexto}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold" },

  filterButtonsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 15, marginBottom: 12 },
  mainFilterButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 5, borderRadius: 10, marginHorizontal: 4 },
  mainFilterText: { marginLeft: 4, fontSize: 13, fontWeight: "bold" },

  anosScrollContainer: { marginBottom: 8 },
  anoPill: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  anoPillText: { fontSize: 14, fontWeight: "700" },

  mesesScrollContainer: { marginBottom: 12 },
  mesPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  mesPillText: { fontSize: 13, fontWeight: "600" },

  // Barra de resumo
  resumoBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, marginBottom: 10 },
  resumoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  resumoReceita: { fontSize: 13, fontWeight: "bold", color: "#2A9D8F" },
  resumoDespesa: { fontSize: 13, fontWeight: "bold", color: "#E76F51" },
  resumoBalanco: { fontSize: 13, fontWeight: "bold" },
  resumoDivider: { width: 1, height: 20 },

  listContainer: { flex: 1, paddingHorizontal: 12 },
  tabelaCard: { marginBottom: 20, borderRadius: 12, borderWidth: 1, overflow: "hidden" },

  monthHeader: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthHeaderText: { fontSize: 16, fontWeight: "bold", textTransform: "capitalize" },
  contadorText: { fontSize: 12 },

  // Novo layout de card de transação
  transacaoCard: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  dataBadge: { alignItems: "center", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginRight: 12, minWidth: 42 },
  dataDia: { fontSize: 16, fontWeight: "bold", lineHeight: 19 },
  dataMes: { fontSize: 9, fontWeight: "600", lineHeight: 12 },
  transacaoInfo: { flex: 1 },
  nomeText: { fontSize: 13, fontWeight: "600", lineHeight: 17 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  pendentePill: { backgroundColor: "#4A1919", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  pendenteText: { fontSize: 9, fontWeight: "700", color: "#FF6B6B" },
  transferPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#4D2C00", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  transferText: { fontSize: 9, fontWeight: "700", color: "#F4A261", marginLeft: 2 },
  transacaoAcoes: { alignItems: "flex-end" },
  valorText: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  acaoBtn: { padding: 2 },

  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyMonthText: { fontStyle: "italic", fontSize: 13, textAlign: "center" },

  tabelaFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1 },
  footerLabel: { fontSize: 11, fontWeight: "600" },
  footerTotais: { flexDirection: "row", gap: 16 },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  footerValorReceita: { fontSize: 13, fontWeight: "700", color: "#2A9D8F" },
  footerValorDespesa: { fontSize: 13, fontWeight: "700", color: "#E76F51" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", padding: 25, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  wrapContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 25, justifyContent: "center" },
  filterPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, flexDirection: "row", alignItems: "center" },
  filterPillText: { fontSize: 14, fontWeight: "500" },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  modalBotaoAplicar: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalBotaoTexto: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
