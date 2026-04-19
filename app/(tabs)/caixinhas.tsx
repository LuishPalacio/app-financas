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
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../_layout";

interface Caixinha {
  id: number;
  nome: string;
  meta_valor: number;
  saldo_atual: number;
  cor: string;
  icone: string;
}

interface Conta {
  id: number;
  nome: string;
  saldo_inicial: number;
}

interface MovimentoCaixinha {
  id: number;
  tipo: string;
  valor: number;
  data_vencimento: string;
  descricao: string;
  conta_id: number;
}

const PALETA_CORES = [
  "#2A9D8F","#E9C46A","#F4A261","#E76F51",
  "#264653","#8AB17D","#8A05BE","#EC7000",
  "#457B9D","#CC092F","#005CA9","#1D3557",
];

const LISTA_ICONES = [
  "savings","flight","home","directions-car","school",
  "fitness-center","local-hospital","shopping-cart","pets",
  "beach-access","sports-esports","music-note","restaurant",
  "local-movies","card-giftcard","smartphone","laptop-mac",
  "favorite","work","celebration",
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
    totalCardBg: isDark ? "#1A1A1A" : "#1A1A1A",
  };

  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  // Modal nova caixinha
  const [modalNovaVisivel, setModalNovaVisivel] = useState(false);
  const [nomeCaixinha, setNomeCaixinha] = useState("");
  const [metaValor, setMetaValor] = useState("");
  const [corSelecionada, setCorSelecionada] = useState(PALETA_CORES[0]);
  const [iconeSelecionado, setIconeSelecionado] = useState("savings");

  // Modal opções (click no card)
  const [modalOpcoesVisivel, setModalOpcoesVisivel] = useState(false);
  const [caixaOpcoes, setCaixaOpcoes] = useState<Caixinha | null>(null);

  // Modal editar caixinha
  const [modalEditarVisivel, setModalEditarVisivel] = useState(false);
  const [nomeEditCaixa, setNomeEditCaixa] = useState("");
  const [metaEditCaixa, setMetaEditCaixa] = useState("");
  const [corEditCaixa, setCorEditCaixa] = useState(PALETA_CORES[0]);
  const [iconeEditCaixa, setIconeEditCaixa] = useState("savings");

  // Modal movimento
  const [modalMovimentoVisivel, setModalMovimentoVisivel] = useState(false);
  const [caixaSelecionada, setCaixaSelecionada] = useState<Caixinha | null>(null);
  const [valorMovimento, setValorMovimento] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState<"guardar" | "resgatar">("guardar");
  const [contaMovimentoId, setContaMovimentoId] = useState<number | null>(null);

  // Modal histórico
  const [modalHistoricoVisivel, setModalHistoricoVisivel] = useState(false);
  const [historicoMovimentos, setHistoricoMovimentos] = useState<MovimentoCaixinha[]>([]);
  const [caixaHistorico, setCaixaHistorico] = useState<Caixinha | null>(null);
  const [filtroMesHistorico, setFiltroMesHistorico] = useState<string>("");

  const carregarDados = async () => {
    if (!session?.user?.id) return;
    try {
      const [resCaixinhas, resContas] = await Promise.all([
        supabase.from("caixinhas").select("*"),
        supabase.from("contas").select("*"),
      ]);
      if (resCaixinhas.data) setCaixinhas(resCaixinhas.data);
      if (resContas.data) setContas(resContas.data);
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(useCallback(() => { carregarDados(); }, [session]));

  const totalGuardado = caixinhas.reduce((acc, curr) => acc + Number(curr.saldo_atual), 0);

  const criarCaixinha = async () => {
    if (nomeCaixinha.trim() === "" || metaValor.trim() === "")
      return Alert.alert("Aviso", "Preenche o nome e a meta.");
    const valorNum = parseFloat(metaValor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) return Alert.alert("Aviso", "Valor inválido.");

    const { error } = await supabase.from("caixinhas").insert([{
      nome: nomeCaixinha, meta_valor: valorNum, saldo_atual: 0,
      cor: corSelecionada, icone: iconeSelecionado, user_id: session.user.id,
    }]);

    if (error) { Alert.alert("Erro", "Não foi possível criar a caixinha."); }
    else {
      setNomeCaixinha(""); setMetaValor(""); setIconeSelecionado("savings");
      setModalNovaVisivel(false); carregarDados();
    }
  };

  const abrirOpcoes = (caixa: Caixinha) => {
    setCaixaOpcoes(caixa);
    setModalOpcoesVisivel(true);
  };

  const abrirEditar = (caixa: Caixinha) => {
    setModalOpcoesVisivel(false);
    setNomeEditCaixa(caixa.nome);
    setMetaEditCaixa(String(caixa.meta_valor));
    setCorEditCaixa(caixa.cor);
    setIconeEditCaixa(caixa.icone);
    setCaixaOpcoes(caixa);
    setModalEditarVisivel(true);
  };

  const salvarEdicaoCaixinha = async () => {
    if (!caixaOpcoes) return;
    const valorNum = parseFloat(metaEditCaixa.replace(",", "."));
    if (nomeEditCaixa.trim() === "" || isNaN(valorNum) || valorNum <= 0)
      return Alert.alert("Aviso", "Nome e meta são obrigatórios.");

    const { error } = await supabase.from("caixinhas").update({
      nome: nomeEditCaixa, meta_valor: valorNum, cor: corEditCaixa, icone: iconeEditCaixa,
    }).eq("id", caixaOpcoes.id);

    if (error) Alert.alert("Erro", "Não foi possível salvar.");
    else { setModalEditarVisivel(false); setCaixaOpcoes(null); carregarDados(); }
  };

  const deletarCaixinha = (caixa: Caixinha) => {
    setModalOpcoesVisivel(false);
    if (Number(caixa.saldo_atual) > 0) {
      return Alert.alert(
        "Ação não permitida",
        `O objetivo "${caixa.nome}" ainda possui R$ ${Number(caixa.saldo_atual).toFixed(2)} guardados.\n\nPara excluir, primeiro resgate todo o saldo para uma conta.`,
        [{ text: "Entendi", style: "cancel" }]
      );
    }
    Alert.alert("Apagar Objetivo", `Tem certeza que quer apagar "${caixa.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => { await supabase.from("caixinhas").delete().eq("id", caixa.id); carregarDados(); } },
    ]);
  };

  const abrirMovimento = (caixa: Caixinha) => {
    setModalOpcoesVisivel(false);
    setCaixaSelecionada(caixa);
    setValorMovimento(""); setTipoMovimento("guardar"); setContaMovimentoId(null);
    setModalMovimentoVisivel(true);
  };

  const abrirHistorico = async (caixa: Caixinha) => {
    setModalOpcoesVisivel(false);
    setCaixaHistorico(caixa);
    const hoje = new Date();
    setFiltroMesHistorico(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);

    const { data } = await supabase
      .from("transacoes")
      .select("id, tipo, valor, data_vencimento, descricao, conta_id")
      .or(`descricao.ilike.Guardar em: ${caixa.nome},descricao.ilike.Resgate de: ${caixa.nome}`)
      .order("data_vencimento", { ascending: false });

    setHistoricoMovimentos(data ?? []);
    setModalHistoricoVisivel(true);
  };

  const executarMovimento = async (valorNum: number, novoSaldo: number) => {
    if (!caixaSelecionada) return;

    const { error: errorCaixinha } = await supabase.from("caixinhas").update({ saldo_atual: novoSaldo }).eq("id", caixaSelecionada.id);
    if (errorCaixinha) return Alert.alert("Erro", "Não foi possível atualizar o saldo.");

    const descricao = tipoMovimento === "guardar"
      ? `Guardar em: ${caixaSelecionada.nome}`
      : `Resgate de: ${caixaSelecionada.nome}`;

    await supabase.from("transacoes").insert([{
      tipo: tipoMovimento === "guardar" ? "despesa" : "receita",
      valor: valorNum, descricao,
      data_vencimento: new Date().toISOString().split("T")[0],
      conta_id: contaMovimentoId, categoria_id: null,
      status: "paga", user_id: session.user.id,
    }]);

    setModalMovimentoVisivel(false); setCaixaSelecionada(null); setContaMovimentoId(null);
    carregarDados();
  };

  const confirmarMovimento = async () => {
    if (!caixaSelecionada) return;
    const valorNum = parseFloat(valorMovimento.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) return Alert.alert("Aviso", "Valor inválido.");
    if (!contaMovimentoId) return Alert.alert("Aviso", "Seleciona uma conta para continuar.");

    let novoSaldoCaixinha = Number(caixaSelecionada.saldo_atual);

    if (tipoMovimento === "guardar") {
      novoSaldoCaixinha += valorNum;
      const conta = contas.find((c) => c.id === contaMovimentoId);
      const { data: transacoesConta } = await supabase.from("transacoes").select("tipo, valor, status").eq("conta_id", contaMovimentoId).eq("status", "paga");
      const rec = (transacoesConta ?? []).filter((t) => t.tipo === "receita").reduce((acc, t) => acc + Number(t.valor), 0);
      const desp = (transacoesConta ?? []).filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + Number(t.valor), 0);
      const saldoReal = Number(conta?.saldo_inicial ?? 0) + rec - desp;

      if (valorNum > saldoReal) {
        return Alert.alert("Saldo insuficiente", `Você não tem saldo suficiente nesta conta (R$ ${saldoReal.toFixed(2)}). Deseja continuar mesmo assim?`, [
          { text: "Cancelar", style: "cancel" },
          { text: "Sim, continuar", style: "destructive", onPress: () => executarMovimento(valorNum, novoSaldoCaixinha) },
        ]);
      }
    } else {
      if (valorNum > novoSaldoCaixinha) return Alert.alert("Aviso", "Não podes resgatar mais do que tens guardado!");
      novoSaldoCaixinha -= valorNum;
    }

    executarMovimento(valorNum, novoSaldoCaixinha);
  };

  const movimentosFiltrados = historicoMovimentos.filter((m) => {
    if (!filtroMesHistorico) return true;
    return (m.data_vencimento || "").startsWith(filtroMesHistorico);
  });

  const totalGuardadoHist = movimentosFiltrados.filter((m) => m.descricao.startsWith("Guardar")).reduce((acc, m) => acc + Number(m.valor), 0);
  const totalResgatadoHist = movimentosFiltrados.filter((m) => m.descricao.startsWith("Resgate")).reduce((acc, m) => acc + Number(m.valor), 0);
  const mesesMovimentos = [...new Set(historicoMovimentos.map((m) => (m.data_vencimento || "").substring(0, 7)))].sort().reverse();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Cores.textoPrincipal }]}>Meus Objetivos</Text>
        <Text style={[styles.subtitle, { color: Cores.textoSecundario }]}>Guarda dinheiro para os seus sonhos</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.totalCard, { backgroundColor: Cores.totalCardBg }]}>
          <Text style={styles.totalCardTitle}>Total Poupado</Text>
          <Text style={styles.totalCardAmount}>R$ {totalGuardado.toFixed(2)}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalNovaVisivel(true)}>
            <Text style={styles.addButtonText}>+ Novo Objetivo</Text>
          </TouchableOpacity>
        </View>

        {caixinhas.length === 0 ? (
          <Text style={[styles.emptyText, { color: Cores.textoSecundario }]}>Ainda não criou nenhuma caixinha.</Text>
        ) : (
          caixinhas.map((caixa) => {
            const porcentagem = Math.min((Number(caixa.saldo_atual) / Number(caixa.meta_valor)) * 100, 100);
            const isCompleto = porcentagem === 100;
            return (
              <TouchableOpacity
                key={caixa.id}
                style={[styles.card, { backgroundColor: Cores.cardFundo, borderColor: Cores.borda }]}
                onPress={() => abrirOpcoes(caixa)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <View style={[styles.iconBox, { backgroundColor: caixa.cor }]}>
                      <MaterialIcons name={caixa.icone as any} size={20} color="#FFF" />
                    </View>
                    <Text style={[styles.caixaName, { color: Cores.textoPrincipal }]}>{caixa.nome}</Text>
                  </View>
                  <Text style={[styles.caixaPercent, { color: Cores.textoSecundario }, isCompleto && { color: "#2A9D8F" }]}>
                    {isCompleto ? "100% 🎉" : `${porcentagem.toFixed(0)}%`}
                  </Text>
                </View>

                <View style={styles.valuesRow}>
                  <Text style={[styles.currentValue, { color: Cores.textoPrincipal }]}>
                    R$ {Number(caixa.saldo_atual).toFixed(2)}
                  </Text>
                  <Text style={[styles.targetValue, { color: Cores.textoSecundario }]}>
                    de R$ {Number(caixa.meta_valor).toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.progressBarBackground, { backgroundColor: Cores.barraFundo }]}>
                  <View style={[styles.progressBarFill, { backgroundColor: isCompleto ? "#2A9D8F" : caixa.cor, width: `${porcentagem}%` }]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL OPÇÕES */}
      <Modal animationType="fade" transparent visible={modalOpcoesVisivel} onRequestClose={() => setModalOpcoesVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
            {caixaOpcoes && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <View style={[styles.iconBox, { backgroundColor: caixaOpcoes.cor, marginRight: 10 }]}>
                  <MaterialIcons name={caixaOpcoes.icone as any} size={20} color="#FFF" />
                </View>
                <Text style={[styles.modalTitle, { color: Cores.textoPrincipal, marginBottom: 0 }]}>{caixaOpcoes.nome}</Text>
              </View>
            )}

            {caixaOpcoes && (
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Text style={{ color: Cores.textoSecundario, fontSize: 13 }}>Saldo atual</Text>
                <Text style={{ color: caixaOpcoes.cor, fontWeight: "bold", fontSize: 22 }}>
                  R$ {Number(caixaOpcoes.saldo_atual).toFixed(2)}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.opcaoBtn, { backgroundColor: "#2A9D8F" }]} onPress={() => caixaOpcoes && abrirMovimento(caixaOpcoes)}>
              <MaterialIcons name="savings" size={20} color="#FFF" />
              <Text style={styles.opcaoBtnText}>Movimentar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.opcaoBtn, { backgroundColor: "#457B9D" }]} onPress={() => caixaOpcoes && abrirHistorico(caixaOpcoes)}>
              <MaterialIcons name="history" size={20} color="#FFF" />
              <Text style={styles.opcaoBtnText}>Histórico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.opcaoBtn, { backgroundColor: "#8AB17D" }]} onPress={() => caixaOpcoes && abrirEditar(caixaOpcoes)}>
              <MaterialIcons name="edit" size={20} color="#FFF" />
              <Text style={styles.opcaoBtnText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.opcaoBtn, { backgroundColor: "#E76F51" }]} onPress={() => caixaOpcoes && deletarCaixinha(caixaOpcoes)}>
              <MaterialIcons name="delete-outline" size={20} color="#FFF" />
              <Text style={styles.opcaoBtnText}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.opcaoBtn, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalOpcoesVisivel(false)}>
              <Text style={[styles.opcaoBtnText, { color: Cores.textoSecundario }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR CAIXINHA */}
      <Modal animationType="slide" transparent visible={modalEditarVisivel} onRequestClose={() => setModalEditarVisivel(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ justifyContent: "center", alignItems: "center", flexGrow: 1, paddingVertical: 20 }}>
            <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
              <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>Editar Objetivo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda, color: Cores.textoPrincipal }]}
                placeholderTextColor={Cores.textoSecundario}
                placeholder="Nome do objetivo"
                value={nomeEditCaixa}
                onChangeText={setNomeEditCaixa}
              />
              <TextInput
                style={[styles.input, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda, color: Cores.textoPrincipal }]}
                placeholderTextColor={Cores.textoSecundario}
                placeholder="Valor da meta"
                value={metaEditCaixa}
                onChangeText={setMetaEditCaixa}
                keyboardType="numeric"
              />
              <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>Cor:</Text>
              <View style={styles.colorPalette}>
                {PALETA_CORES.map((cor) => (
                  <TouchableOpacity
                    key={cor}
                    style={[styles.colorOption, { backgroundColor: cor }, corEditCaixa === cor && { borderWidth: 3, borderColor: Cores.textoPrincipal }]}
                    onPress={() => setCorEditCaixa(cor)}
                  />
                ))}
              </View>
              <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>Ícone:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {LISTA_ICONES.map((icone) => (
                  <TouchableOpacity
                    key={icone}
                    style={[styles.iconeOpcao, { backgroundColor: iconeEditCaixa === icone ? corEditCaixa : Cores.pillFundo }]}
                    onPress={() => setIconeEditCaixa(icone)}
                  >
                    <MaterialIcons name={icone as any} size={22} color={iconeEditCaixa === icone ? "#FFF" : Cores.textoSecundario} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <Button title="Cancelar" color="#999" onPress={() => setModalEditarVisivel(false)} />
                <Button title="Salvar" color="#2A9D8F" onPress={salvarEdicaoCaixinha} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL CRIAR CAIXINHA */}
      <Modal animationType="slide" transparent visible={modalNovaVisivel} onRequestClose={() => setModalNovaVisivel(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ justifyContent: "center", alignItems: "center", flexGrow: 1, paddingVertical: 20 }}>
            <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
              <Text style={[styles.modalTitle, { color: Cores.textoPrincipal }]}>Novo Objetivo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda, color: Cores.textoPrincipal }]}
                placeholderTextColor={Cores.textoSecundario}
                placeholder="Nome (Ex: Viagem, PC Novo)"
                value={nomeCaixinha}
                onChangeText={setNomeCaixinha}
              />
              <TextInput
                style={[styles.input, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda, color: Cores.textoPrincipal }]}
                placeholderTextColor={Cores.textoSecundario}
                placeholder="Qual é o valor da meta? (Ex: 1500)"
                value={metaValor}
                onChangeText={setMetaValor}
                keyboardType="numeric"
              />
              <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>Cor:</Text>
              <View style={styles.colorPalette}>
                {PALETA_CORES.map((cor) => (
                  <TouchableOpacity
                    key={cor}
                    style={[styles.colorOption, { backgroundColor: cor }, corSelecionada === cor && { borderWidth: 3, borderColor: Cores.textoPrincipal }]}
                    onPress={() => setCorSelecionada(cor)}
                  />
                ))}
              </View>
              <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>Ícone:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {LISTA_ICONES.map((icone) => (
                  <TouchableOpacity
                    key={icone}
                    style={[styles.iconeOpcao, { backgroundColor: iconeSelecionado === icone ? corSelecionada : Cores.pillFundo }]}
                    onPress={() => setIconeSelecionado(icone)}
                  >
                    <MaterialIcons name={icone as any} size={22} color={iconeSelecionado === icone ? "#FFF" : Cores.textoSecundario} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <Button title="Cancelar" color="#999" onPress={() => setModalNovaVisivel(false)} />
                <Button title="Criar" color="#2A9D8F" onPress={criarCaixinha} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL MOVIMENTAR */}
      <Modal animationType="fade" transparent visible={modalMovimentoVisivel} onRequestClose={() => setModalMovimentoVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              {caixaSelecionada && (
                <View style={[styles.iconBox, { backgroundColor: caixaSelecionada.cor, marginRight: 10 }]}>
                  <MaterialIcons name={caixaSelecionada.icone as any} size={20} color="#FFF" />
                </View>
              )}
              <Text style={[styles.modalTitle, { color: Cores.textoPrincipal, marginBottom: 0 }]}>{caixaSelecionada?.nome}</Text>
            </View>

            {caixaSelecionada && (
              <View style={{ alignItems: "center", marginBottom: 15 }}>
                <Text style={{ color: Cores.textoSecundario, fontSize: 13 }}>Guardado atualmente</Text>
                <Text style={{ color: caixaSelecionada.cor, fontWeight: "bold", fontSize: 20 }}>
                  R$ {Number(caixaSelecionada.saldo_atual).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.typeSelector, { borderColor: Cores.borda }]}>
              <TouchableOpacity style={[styles.typeButton, { backgroundColor: Cores.inputFundo }, tipoMovimento === "guardar" && { backgroundColor: "#2A9D8F" }]} onPress={() => setTipoMovimento("guardar")}>
                <Text style={[styles.typeButtonText, { color: Cores.textoSecundario }, tipoMovimento === "guardar" && { color: "#FFF" }]}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeButton, { backgroundColor: Cores.inputFundo }, tipoMovimento === "resgatar" && { backgroundColor: "#E76F51" }]} onPress={() => setTipoMovimento("resgatar")}>
                <Text style={[styles.typeButtonText, { color: Cores.textoSecundario }, tipoMovimento === "resgatar" && { color: "#FFF" }]}>Resgatar</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda, color: Cores.textoPrincipal }]}
              placeholderTextColor={Cores.textoSecundario}
              placeholder={tipoMovimento === "guardar" ? "Valor a adicionar (Ex: 50)" : "Valor a resgatar (Ex: 50)"}
              value={valorMovimento}
              onChangeText={setValorMovimento}
              keyboardType="numeric"
            />

            <Text style={[styles.colorLabel, { color: Cores.textoSecundario }]}>
              {tipoMovimento === "guardar" ? "Saiu de qual conta?" : "Vai entrar em qual conta?"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contaScroll}>
              {contas.map((conta) => (
                <TouchableOpacity
                  key={conta.id}
                  style={[styles.contaPill, { backgroundColor: Cores.inputFundo, borderColor: Cores.borda }, contaMovimentoId === conta.id && { borderColor: tipoMovimento === "guardar" ? "#2A9D8F" : "#E76F51", borderWidth: 2 }]}
                  onPress={() => setContaMovimentoId(conta.id)}
                >
                  <MaterialIcons name="account-balance-wallet" size={14} color={contaMovimentoId === conta.id ? (tipoMovimento === "guardar" ? "#2A9D8F" : "#E76F51") : Cores.textoSecundario} style={{ marginRight: 6 }} />
                  <Text style={[styles.contaPillText, { color: contaMovimentoId === conta.id ? Cores.textoPrincipal : Cores.textoSecundario }]}>{conta.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button title="Cancelar" color="#999" onPress={() => setModalMovimentoVisivel(false)} />
              <Button title="Confirmar" color={isDark ? "#FFF" : "#1A1A1A"} onPress={confirmarMovimento} />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL HISTÓRICO */}
      <Modal animationType="slide" transparent visible={modalHistoricoVisivel} onRequestClose={() => setModalHistoricoVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.cardFundo, width: "95%", maxHeight: "85%" }]}>
            {caixaHistorico && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 15 }}>
                <View style={[styles.iconBox, { backgroundColor: caixaHistorico.cor, marginRight: 10 }]}>
                  <MaterialIcons name={caixaHistorico.icone as any} size={18} color="#FFF" />
                </View>
                <Text style={[styles.modalTitle, { color: Cores.textoPrincipal, marginBottom: 0 }]}>Histórico</Text>
              </View>
            )}

            {mesesMovimentos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.mesFiltro, { backgroundColor: filtroMesHistorico === "" ? Cores.textoPrincipal : Cores.pillFundo }]}
                  onPress={() => setFiltroMesHistorico("")}
                >
                  <Text style={{ color: filtroMesHistorico === "" ? Cores.fundo : Cores.textoSecundario, fontSize: 12, fontWeight: "600" }}>Todos</Text>
                </TouchableOpacity>
                {mesesMovimentos.map((mes) => {
                  const [ano, mesNum] = mes.split("-");
                  const isAtivo = filtroMesHistorico === mes;
                  return (
                    <TouchableOpacity key={mes} style={[styles.mesFiltro, { backgroundColor: isAtivo ? Cores.textoPrincipal : Cores.pillFundo }]} onPress={() => setFiltroMesHistorico(mes)}>
                      <Text style={{ color: isAtivo ? Cores.fundo : Cores.textoSecundario, fontSize: 12, fontWeight: "600" }}>
                        {MESES[parseInt(mesNum, 10) - 1]} {ano}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {movimentosFiltrados.length > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 12, padding: 10, backgroundColor: Cores.pillFundo, borderRadius: 10 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: Cores.textoSecundario, fontSize: 11 }}>Guardado</Text>
                  <Text style={{ color: "#2A9D8F", fontWeight: "bold", fontSize: 14 }}>R$ {totalGuardadoHist.toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: Cores.textoSecundario, fontSize: 11 }}>Resgatado</Text>
                  <Text style={{ color: "#E76F51", fontWeight: "bold", fontSize: 14 }}>R$ {totalResgatadoHist.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {movimentosFiltrados.length === 0 ? (
                <Text style={{ color: Cores.textoSecundario, textAlign: "center", fontStyle: "italic", paddingVertical: 20 }}>
                  Nenhum movimento registrado.
                </Text>
              ) : (
                movimentosFiltrados.map((mov) => {
                  const isGuardar = mov.descricao.startsWith("Guardar");
                  const conta = contas.find((c) => c.id === mov.conta_id);
                  const partes = (mov.data_vencimento || "0000-00-00").split("-");
                  return (
                    <View key={mov.id} style={[styles.movRow, { backgroundColor: Cores.pillFundo }]}>
                      <View style={[styles.movIcone, { backgroundColor: isGuardar ? "#2A9D8F22" : "#E76F5122" }]}>
                        <MaterialIcons name={isGuardar ? "arrow-downward" : "arrow-upward"} size={16} color={isGuardar ? "#2A9D8F" : "#E76F51"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Cores.textoPrincipal, fontWeight: "600", fontSize: 13 }}>
                          {isGuardar ? "Guardado" : "Resgatado"}
                        </Text>
                        {conta && (
                          <Text style={{ color: Cores.textoSecundario, fontSize: 11 }}>{conta.nome}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: isGuardar ? "#2A9D8F" : "#E76F51", fontWeight: "bold", fontSize: 14 }}>
                          {isGuardar ? "+" : "-"} R$ {Number(mov.valor).toFixed(2)}
                        </Text>
                        <Text style={{ color: Cores.textoSecundario, fontSize: 11 }}>
                          {partes[2]}/{partes[1]}/{partes[0]}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={{ marginTop: 15 }}>
              <Button title="Fechar" color="#999" onPress={() => setModalHistoricoVisivel(false)} />
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
  totalCard: { padding: 20, borderRadius: 16, marginBottom: 25, elevation: 4, alignItems: "center" },
  totalCardTitle: { color: "#999", fontSize: 14, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  totalCardAmount: { color: "#FFF", fontSize: 36, fontWeight: "bold", marginTop: 5, marginBottom: 15 },
  addButton: { backgroundColor: "#FFF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  addButtonText: { color: "#1A1A1A", fontWeight: "bold" },
  emptyText: { fontStyle: "italic", textAlign: "center", marginTop: 20 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 10 },
  caixaName: { fontSize: 18, fontWeight: "bold" },
  caixaPercent: { fontSize: 14, fontWeight: "bold" },
  valuesRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  currentValue: { fontSize: 20, fontWeight: "bold", marginRight: 5 },
  targetValue: { fontSize: 14, fontWeight: "500" },
  progressBarBackground: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", padding: 25, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  colorLabel: { fontSize: 14, fontWeight: "500", marginBottom: 10 },
  colorPalette: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  colorOption: { width: 35, height: 35, borderRadius: 17.5 },
  iconeOpcao: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalButtons: { flexDirection: "row", justifyContent: "space-around" },
  typeSelector: { flexDirection: "row", marginBottom: 20, borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  typeButton: { flex: 1, padding: 12, alignItems: "center" },
  typeButtonText: { fontWeight: "bold" },
  contaScroll: { flexDirection: "row", marginBottom: 20 },
  contaPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  contaPillText: { fontSize: 14, fontWeight: "500" },
  mesFiltro: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8 },
  movRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, marginBottom: 8, gap: 10 },
  movIcone: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  opcaoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 10, marginBottom: 10, gap: 8 },
  opcaoBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  pillFundo: {},
});
