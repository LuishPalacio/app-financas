import { MaterialIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../_layout";

export default function ConfiguracoesScreen() {
  const { isDark, toggleTheme, isBiometricEnabled, toggleBiometric, session } = useAppTheme();

  const meuEmail = session?.user?.email || "";
  const meuId = session?.user?.id;

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    texto: isDark ? "#ffffff" : "#1A1A1A",
    secundario: isDark ? "#AAAAAA" : "#666666",
    card: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333" : "#EEE",
    input: isDark ? "#2C2C2C" : "#FFF",
    pillFundo: isDark ? "#2C2C2C" : "#F0F0F0",
  };

  // Parceria
  const [parceria, setParceria] = useState<any>(null);
  const [emailConvite, setEmailConvite] = useState("");
  const [loadingParceria, setLoadingParceria] = useState(false);

  // Edição de perfil
  const [modalPerfilVisivel, setModalPerfilVisivel] = useState(false);
  const [nomeEdit, setNomeEdit] = useState("");
  const [emailEdit, setEmailEdit] = useState("");
  const [telefoneEdit, setTelefoneEdit] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [abaPerfilAtiva, setAbaPerfilAtiva] = useState<"dados" | "senha">("dados");

  const carregarParceria = async () => {
    if (!meuId || !meuEmail) return;
    const { data } = await supabase
      .from("parcerias")
      .select("*")
      .or(`solicitante_id.eq.${meuId},convidado_id.eq.${meuId},convidado_email.eq.${meuEmail}`)
      .limit(1);
    setParceria(data && data.length > 0 ? data[0] : null);
  };

  useFocusEffect(useCallback(() => {
    carregarParceria();
    // Preencher campos do perfil com dados atuais
    const meta = session?.user?.user_metadata;
    setNomeEdit(meta?.nome_usuario || meta?.full_name || "");
    setTelefoneEdit(meta?.telefone || "");
    setEmailEdit(meuEmail);
  }, [session]));

  const enviarConvite = async () => {
    if (!emailConvite.trim()) return Alert.alert("Aviso", "Digite o e-mail do seu parceiro(a).");
    if (emailConvite.toLowerCase() === meuEmail.toLowerCase()) return Alert.alert("Aviso", "Você não pode convidar a si mesmo!");
    setLoadingParceria(true);
    const { error } = await supabase.from("parcerias").insert([{ solicitante_id: meuId, convidado_email: emailConvite.toLowerCase().trim(), status: "pendente" }]);
    setLoadingParceria(false);
    if (error) Alert.alert("Erro", "Não foi possível enviar o convite. Tente novamente.");
    else { Alert.alert("Sucesso", "Convite enviado com sucesso!"); setEmailConvite(""); carregarParceria(); }
  };

  const aceitarConvite = async () => {
    setLoadingParceria(true);
    const { error } = await supabase.from("parcerias").update({ convidado_id: meuId, status: "aceito" }).eq("id", parceria.id);
    setLoadingParceria(false);
    if (error) Alert.alert("Erro", "Falha ao aceitar o convite.");
    else { Alert.alert("Parceria Formada! 🎉", "Agora vocês podem criar Contas Conjuntas!"); carregarParceria(); }
  };

  const deletarParceria = async (mensagem: string) => {
    Alert.alert("Atenção", mensagem, [
      { text: "Não", style: "cancel" },
      { text: "Sim", style: "destructive", onPress: async () => { setLoadingParceria(true); await supabase.from("parcerias").delete().eq("id", parceria.id); setParceria(null); setLoadingParceria(false); } },
    ]);
  };

  const handleBiometricToggle = async (novoValor: boolean) => {
    if (novoValor) {
      const temHardware = await LocalAuthentication.hasHardwareAsync();
      const temBiometria = await LocalAuthentication.isEnrolledAsync();
      if (!temHardware || !temBiometria) { Alert.alert("Aviso", "O seu celular não possui biometria configurada."); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirme a biometria" });
      if (result.success) { toggleBiometric(true); Alert.alert("Sucesso", "Proteção biométrica ativada!"); }
    } else {
      toggleBiometric(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sair da Conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  const salvarPerfil = async () => {
    if (nomeEdit.trim() === "") return Alert.alert("Aviso", "O nome não pode ficar vazio.");
    setLoadingPerfil(true);

    const updates: any = { data: { nome_usuario: nomeEdit.trim(), telefone: telefoneEdit.trim() } };

    // Se email mudou
    if (emailEdit.trim().toLowerCase() !== meuEmail.toLowerCase() && emailEdit.trim() !== "") {
      const { error: emailError } = await supabase.auth.updateUser({ email: emailEdit.trim().toLowerCase() });
      if (emailError) {
        setLoadingPerfil(false);
        return Alert.alert("Erro", "Não foi possível atualizar o e-mail. " + emailError.message);
      }
    }

    const { error } = await supabase.auth.updateUser(updates);
    setLoadingPerfil(false);

    if (error) Alert.alert("Erro", "Não foi possível salvar as alterações.");
    else { Alert.alert("Sucesso", "Perfil atualizado com sucesso!"); setModalPerfilVisivel(false); }
  };

  const alterarSenha = async () => {
    if (novaSenha.length < 6) return Alert.alert("Aviso", "A nova senha deve ter pelo menos 6 caracteres.");
    setLoadingPerfil(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoadingPerfil(false);
    if (error) Alert.alert("Erro", "Não foi possível alterar a senha. " + error.message);
    else { Alert.alert("Sucesso", "Senha alterada com sucesso!"); setNovaSenha(""); setModalPerfilVisivel(false); }
  };

  const confirmarApagarConta = () => {
    Alert.alert(
      "Apagar Conta",
      "⚠️ Esta ação é irreversível!\n\nTodos os seus dados (transações, contas, objetivos e categorias) serão permanentemente apagados.\n\nTem certeza absoluta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, apagar tudo",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmação Final",
              "Digite 'APAGAR' para confirmar a exclusão permanente da conta.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Confirmar exclusão",
                  style: "destructive",
                  onPress: async () => {
                    await apagarContaCompleta();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const apagarContaCompleta = async () => {
    if (!meuId) return;
    try {
      // Apagar todos os dados do usuário
      await Promise.all([
        supabase.from("transacoes").delete().eq("user_id", meuId),
        supabase.from("caixinhas").delete().eq("user_id", meuId),
        supabase.from("contas").delete().eq("user_id", meuId),
        supabase.from("categorias").delete().eq("user_id", meuId),
        supabase.from("parcerias").delete().or(`solicitante_id.eq.${meuId},convidado_id.eq.${meuId}`),
      ]);

      // Fazer logout (a conta de auth seria apagada via função no backend idealmente)
      await supabase.auth.signOut();
      Alert.alert("Conta apagada", "Seus dados foram removidos com sucesso.");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível apagar todos os dados. Tente novamente.");
    }
  };

  const nomeUsuario = session?.user?.user_metadata?.nome_usuario || session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Usuário";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Cores.texto }]}>Configurações</Text>
        </View>

        <View style={styles.content}>

          {/* PERFIL DO USUÁRIO */}
          <TouchableOpacity
            style={[styles.perfilCard, { backgroundColor: Cores.card, borderColor: Cores.borda }]}
            onPress={() => {
              const meta = session?.user?.user_metadata;
              setNomeEdit(meta?.nome_usuario || meta?.full_name || "");
              setTelefoneEdit(meta?.telefone || "");
              setEmailEdit(meuEmail);
              setNovaSenha("");
              setAbaPerfilAtiva("dados");
              setModalPerfilVisivel(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.perfilAvatar}>
              <Text style={styles.perfilAvatarLetra}>{nomeUsuario.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.perfilNome, { color: Cores.texto }]}>{nomeUsuario}</Text>
              <Text style={[styles.perfilEmail, { color: Cores.secundario }]}>{meuEmail}</Text>
            </View>
            <MaterialIcons name="edit" size={20} color={Cores.secundario} />
          </TouchableOpacity>

          {/* PREFERÊNCIAS */}
          <Text style={[styles.sectionTitle, { color: Cores.secundario, marginTop: 20 }]}>PREFERÊNCIAS</Text>
          <View style={[styles.configGroup, { backgroundColor: Cores.card, borderColor: Cores.borda }]}>
            <View style={[styles.configRow, { borderBottomWidth: 1, borderBottomColor: Cores.borda }]}>
              <View style={styles.configLeft}>
                <MaterialIcons name={isDark ? "dark-mode" : "light-mode"} size={24} color={isDark ? "#E9C46A" : "#F4A261"} />
                <Text style={[styles.configText, { color: Cores.texto }]}>Modo Escuro</Text>
              </View>
              <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: "#767577", true: "#2A9D8F" }} />
            </View>
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <MaterialIcons name={isBiometricEnabled ? "lock" : "lock-open"} size={24} color={isBiometricEnabled ? "#457B9D" : "#999"} />
                <Text style={[styles.configText, { color: Cores.texto }]}>Segurança (Biometria)</Text>
              </View>
              <Switch value={isBiometricEnabled} onValueChange={handleBiometricToggle} trackColor={{ false: "#767577", true: "#457B9D" }} />
            </View>
          </View>

          {/* CONTA CONJUNTA */}
          <Text style={[styles.sectionTitle, { color: Cores.secundario, marginTop: 25 }]}>CONTA CONJUNTA (PARCEIRO)</Text>
          <View style={[styles.configGroup, { backgroundColor: Cores.card, borderColor: Cores.borda, padding: 15 }]}>
            {loadingParceria ? (
              <ActivityIndicator size="small" color="#2A9D8F" style={{ padding: 20 }} />
            ) : !parceria ? (
              <>
                <Text style={[styles.helpText, { color: Cores.secundario }]}>Vincule a conta do seu cônjuge/parceiro para poderem partilhar despesas.</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Cores.input, borderColor: Cores.borda, color: Cores.texto }]}
                  placeholder="E-mail da conta do parceiro(a)"
                  placeholderTextColor={Cores.secundario}
                  value={emailConvite}
                  onChangeText={setEmailConvite}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity style={styles.actionBtn} onPress={enviarConvite}>
                  <Text style={styles.actionBtnText}>Enviar Convite</Text>
                </TouchableOpacity>
              </>
            ) : parceria.status === "pendente" ? (
              parceria.solicitante_id === meuId ? (
                <View style={styles.centerBox}>
                  <MaterialIcons name="hourglass-empty" size={30} color="#F4A261" />
                  <Text style={[styles.statusText, { color: Cores.texto }]}>Aguardando aceitação de:</Text>
                  <Text style={[styles.emailText, { color: Cores.texto }]}>{parceria.convidado_email}</Text>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#E76F51", marginTop: 15 }]} onPress={() => deletarParceria("Deseja cancelar este convite?")}>
                    <Text style={styles.actionBtnText}>Cancelar Convite</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.centerBox}>
                  <MaterialIcons name="mail" size={30} color="#2A9D8F" />
                  <Text style={[styles.statusText, { color: Cores.texto }]}>Você recebeu um convite para Conta Conjunta!</Text>
                  <View style={styles.rowBtns}>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: "#E76F51", marginRight: 10 }]} onPress={() => deletarParceria("Deseja recusar o convite?")}>
                      <Text style={styles.actionBtnText}>Recusar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={aceitarConvite}>
                      <Text style={styles.actionBtnText}>Aceitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : (
              <View style={styles.centerBox}>
                <MaterialIcons name="favorite" size={40} color="#E76F51" />
                <Text style={[styles.statusText, { color: Cores.texto, marginTop: 10 }]}>Contas vinculadas com sucesso!</Text>
                <Text style={[styles.helpText, { color: Cores.secundario, textAlign: "center", marginTop: 5 }]}>
                  Agora você verá a opção "Compartilhar" ao criar uma Conta Nova.
                </Text>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#E76F51", marginTop: 20 }]} onPress={() => deletarParceria("Tem certeza que deseja desfazer o vínculo com seu parceiro(a)?")}>
                  <Text style={[styles.actionBtnText, { color: "#E76F51" }]}>Desfazer Vínculo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SAIR */}
          <TouchableOpacity style={[styles.logoutButton, { borderColor: Cores.borda }]} onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#E76F51" />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>

          {/* APAGAR CONTA */}
          <TouchableOpacity style={styles.apagarContaBtn} onPress={confirmarApagarConta}>
            <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
            <Text style={styles.apagarContaText}>Apagar Minha Conta</Text>
          </TouchableOpacity>

          <Text style={[styles.apagarContaAviso, { color: Cores.secundario }]}>
            A exclusão remove permanentemente todos os seus dados do servidor.
          </Text>

        </View>
      </ScrollView>

      {/* MODAL DE EDIÇÃO DE PERFIL */}
      {modalPerfilVisivel && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Cores.card }]}>
            <Text style={[styles.modalTitle, { color: Cores.texto }]}>Editar Perfil</Text>

            {/* Abas */}
            <View style={[styles.abaSelector, { backgroundColor: Cores.pillFundo }]}>
              <TouchableOpacity
                style={[styles.abaBtn, abaPerfilAtiva === "dados" && { backgroundColor: Cores.card }]}
                onPress={() => setAbaPerfilAtiva("dados")}
              >
                <Text style={[styles.abaBtnText, { color: abaPerfilAtiva === "dados" ? Cores.texto : Cores.secundario }]}>Dados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.abaBtn, abaPerfilAtiva === "senha" && { backgroundColor: Cores.card }]}
                onPress={() => setAbaPerfilAtiva("senha")}
              >
                <Text style={[styles.abaBtnText, { color: abaPerfilAtiva === "senha" ? Cores.texto : Cores.secundario }]}>Senha</Text>
              </TouchableOpacity>
            </View>

            {abaPerfilAtiva === "dados" ? (
              <>
                <Text style={[styles.inputLabel, { color: Cores.secundario }]}>Nome</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Cores.input, borderColor: Cores.borda, color: Cores.texto }]}
                  placeholder="Seu nome"
                  placeholderTextColor={Cores.secundario}
                  value={nomeEdit}
                  onChangeText={setNomeEdit}
                />
                <Text style={[styles.inputLabel, { color: Cores.secundario }]}>E-mail</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Cores.input, borderColor: Cores.borda, color: Cores.texto }]}
                  placeholder="Seu e-mail"
                  placeholderTextColor={Cores.secundario}
                  value={emailEdit}
                  onChangeText={setEmailEdit}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={[styles.inputLabel, { color: Cores.secundario }]}>Telefone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Cores.input, borderColor: Cores.borda, color: Cores.texto }]}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={Cores.secundario}
                  value={telefoneEdit}
                  onChangeText={setTelefoneEdit}
                  keyboardType="phone-pad"
                />
                {loadingPerfil ? (
                  <ActivityIndicator size="small" color="#2A9D8F" style={{ marginTop: 10 }} />
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalPerfilVisivel(false)}>
                      <Text style={[styles.modalBtnText, { color: Cores.texto }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#2A9D8F" }]} onPress={salvarPerfil}>
                      <Text style={[styles.modalBtnText, { color: "#FFF" }]}>Salvar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: Cores.secundario }]}>Nova Senha</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Cores.input, borderColor: Cores.borda, color: Cores.texto }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Cores.secundario}
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  secureTextEntry
                />
                <Text style={[{ color: Cores.secundario, fontSize: 12, marginBottom: 15, marginTop: -10 }]}>
                  Um link de confirmação pode ser enviado para o seu e-mail.
                </Text>
                {loadingPerfil ? (
                  <ActivityIndicator size="small" color="#2A9D8F" style={{ marginTop: 10 }} />
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Cores.pillFundo }]} onPress={() => setModalPerfilVisivel(false)}>
                      <Text style={[styles.modalBtnText, { color: Cores.texto }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#457B9D" }]} onPress={alterarSenha}>
                      <Text style={[styles.modalBtnText, { color: "#FFF" }]}>Alterar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  content: { padding: 20 },

  perfilCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 5 },
  perfilAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#2A9D8F", alignItems: "center", justifyContent: "center", marginRight: 14 },
  perfilAvatarLetra: { color: "#FFF", fontSize: 22, fontWeight: "bold" },
  perfilNome: { fontSize: 17, fontWeight: "bold" },
  perfilEmail: { fontSize: 13, marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 10, marginLeft: 5, letterSpacing: 1 },
  configGroup: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  configRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  configLeft: { flexDirection: "row", alignItems: "center" },
  configText: { fontSize: 16, fontWeight: "600", marginLeft: 15 },

  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 18, marginTop: 30, borderRadius: 12, borderWidth: 1, backgroundColor: "rgba(231, 111, 81, 0.1)" },
  logoutText: { color: "#E76F51", fontSize: 16, fontWeight: "bold", marginLeft: 10 },

  apagarContaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FF444433", backgroundColor: "rgba(255, 68, 68, 0.05)" },
  apagarContaText: { color: "#FF4444", fontSize: 15, fontWeight: "bold", marginLeft: 8 },
  apagarContaAviso: { fontSize: 11, textAlign: "center", marginTop: 6, marginBottom: 30 },

  helpText: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 15 },
  actionBtn: { backgroundColor: "#2A9D8F", padding: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  centerBox: { alignItems: "center", paddingVertical: 10 },
  statusText: { fontSize: 15, marginTop: 10, textAlign: "center" },
  emailText: { fontSize: 16, fontWeight: "bold", marginTop: 5, marginBottom: 15 },
  rowBtns: { flexDirection: "row", width: "100%" },

  // Modal de perfil
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "92%", padding: 24, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  abaSelector: { flexDirection: "row", borderRadius: 10, padding: 3, marginBottom: 20 },
  abaBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  abaBtnText: { fontWeight: "600", fontSize: 14 },
  inputLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 5 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  modalBtnText: { fontWeight: "bold", fontSize: 15 },
});
