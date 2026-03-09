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
  const { isDark, toggleTheme, isBiometricEnabled, toggleBiometric, session } =
    useAppTheme();

  const meuEmail = session?.user?.email || "";
  const meuId = session?.user?.id;

  const Cores = {
    fundo: isDark ? "#121212" : "#ffffff",
    texto: isDark ? "#ffffff" : "#1A1A1A",
    secundario: isDark ? "#AAAAAA" : "#666666",
    card: isDark ? "#1E1E1E" : "#F8F9FA",
    borda: isDark ? "#333" : "#EEE",
    input: isDark ? "#2C2C2C" : "#FFF",
  };

  // ESTADOS DA PARCERIA
  const [parceria, setParceria] = useState<any>(null);
  const [emailConvite, setEmailConvite] = useState("");
  const [loadingParceria, setLoadingParceria] = useState(false);

  // BUSCA SE O USUÁRIO TEM ALGUM CONVITE OU PARCERIA ATIVA
  const carregarParceria = async () => {
    if (!meuId || !meuEmail) return;

    const { data, error } = await supabase
      .from("parcerias")
      .select("*")
      .or(
        `solicitante_id.eq.${meuId},convidado_id.eq.${meuId},convidado_email.eq.${meuEmail}`,
      )
      .limit(1);

    if (data && data.length > 0) {
      setParceria(data[0]);
    } else {
      setParceria(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarParceria();
    }, []),
  );

  // ENVIAR CONVITE
  const enviarConvite = async () => {
    if (!emailConvite.trim())
      return Alert.alert("Aviso", "Digite o e-mail do seu parceiro(a).");
    if (emailConvite.toLowerCase() === meuEmail.toLowerCase())
      return Alert.alert("Aviso", "Você não pode convidar a si mesmo!");

    setLoadingParceria(true);
    const { error } = await supabase.from("parcerias").insert([
      {
        solicitante_id: meuId,
        convidado_email: emailConvite.toLowerCase().trim(),
        status: "pendente",
      },
    ]);
    setLoadingParceria(false);

    if (error) {
      Alert.alert(
        "Erro",
        "Não foi possível enviar o convite. Tente novamente.",
      );
    } else {
      Alert.alert("Sucesso", "Convite enviado com sucesso!");
      setEmailConvite("");
      carregarParceria();
    }
  };

  // ACEITAR CONVITE
  const aceitarConvite = async () => {
    setLoadingParceria(true);
    const { error } = await supabase
      .from("parcerias")
      .update({
        convidado_id: meuId,
        status: "aceito",
      })
      .eq("id", parceria.id);
    setLoadingParceria(false);

    if (error) Alert.alert("Erro", "Falha ao aceitar o convite.");
    else {
      Alert.alert(
        "Parceria Formada! 🎉",
        "Agora vocês podem criar Contas Conjuntas!",
      );
      carregarParceria();
    }
  };

  // CANCELAR / RECUSAR / DESFAZER VÍNCULO
  const deletarParceria = async (mensagem: string) => {
    Alert.alert("Atenção", mensagem, [
      { text: "Não", style: "cancel" },
      {
        text: "Sim",
        style: "destructive",
        onPress: async () => {
          setLoadingParceria(true);
          await supabase.from("parcerias").delete().eq("id", parceria.id);
          setParceria(null);
          setLoadingParceria(false);
        },
      },
    ]);
  };

  // CONTROLES EXISTENTES
  const handleBiometricToggle = async (novoValor: boolean) => {
    if (novoValor) {
      const temHardware = await LocalAuthentication.hasHardwareAsync();
      const temBiometria = await LocalAuthentication.isEnrolledAsync();

      if (!temHardware || !temBiometria) {
        Alert.alert("Aviso", "O seu celular não possui biometria configurada.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirme a biometria",
      });
      if (result.success) {
        toggleBiometric(true);
        Alert.alert("Sucesso", "Proteção biométrica ativada!");
      }
    } else {
      toggleBiometric(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sair da Conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Cores.fundo }]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Cores.texto }]}>
            Configurações
          </Text>
        </View>

        <View style={styles.content}>
          {/* SESSÃO: PREFERÊNCIAS */}
          <Text style={[styles.sectionTitle, { color: Cores.secundario }]}>
            PREFERÊNCIAS
          </Text>
          <View
            style={[
              styles.configGroup,
              { backgroundColor: Cores.card, borderColor: Cores.borda },
            ]}
          >
            <View
              style={[
                styles.configRow,
                { borderBottomWidth: 1, borderBottomColor: Cores.borda },
              ]}
            >
              <View style={styles.configLeft}>
                <MaterialIcons
                  name={isDark ? "dark-mode" : "light-mode"}
                  size={24}
                  color={isDark ? "#E9C46A" : "#F4A261"}
                />
                <Text style={[styles.configText, { color: Cores.texto }]}>
                  Modo Escuro
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: "#767577", true: "#2A9D8F" }}
              />
            </View>

            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <MaterialIcons
                  name={isBiometricEnabled ? "lock" : "lock-open"}
                  size={24}
                  color={isBiometricEnabled ? "#457B9D" : "#999"}
                />
                <Text style={[styles.configText, { color: Cores.texto }]}>
                  Segurança (Biometria)
                </Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: "#767577", true: "#457B9D" }}
              />
            </View>
          </View>

          {/* SESSÃO: CONTA CONJUNTA */}
          <Text
            style={[
              styles.sectionTitle,
              { color: Cores.secundario, marginTop: 25 },
            ]}
          >
            CONTA CONJUNTA (PARCEIRO)
          </Text>
          <View
            style={[
              styles.configGroup,
              {
                backgroundColor: Cores.card,
                borderColor: Cores.borda,
                padding: 15,
              },
            ]}
          >
            {loadingParceria ? (
              <ActivityIndicator
                size="small"
                color="#2A9D8F"
                style={{ padding: 20 }}
              />
            ) : !parceria ? (
              // ESTADO 1: NÃO TEM PARCERIA NEM CONVITE
              <>
                <Text style={[styles.helpText, { color: Cores.secundario }]}>
                  Vincule a conta do seu cônjuge/parceiro para poderem partilhar
                  despesas.
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: Cores.input,
                      borderColor: Cores.borda,
                      color: Cores.texto,
                    },
                  ]}
                  placeholder="E-mail da conta do parceiro(a)"
                  placeholderTextColor={Cores.secundario}
                  value={emailConvite}
                  onChangeText={setEmailConvite}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={enviarConvite}
                >
                  <Text style={styles.actionBtnText}>Enviar Convite</Text>
                </TouchableOpacity>
              </>
            ) : parceria.status === "pendente" ? (
              // ESTADO 2: TEM UM CONVITE PENDENTE
              parceria.solicitante_id === meuId ? (
                // Eu enviei o convite
                <View style={styles.centerBox}>
                  <MaterialIcons
                    name="hourglass-empty"
                    size={30}
                    color="#F4A261"
                  />
                  <Text style={[styles.statusText, { color: Cores.texto }]}>
                    Aguardando aceitação de:
                  </Text>
                  <Text style={[styles.emailText, { color: Cores.texto }]}>
                    {parceria.convidado_email}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: "#E76F51", marginTop: 15 },
                    ]}
                    onPress={() =>
                      deletarParceria("Deseja cancelar este convite?")
                    }
                  >
                    <Text style={styles.actionBtnText}>Cancelar Convite</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Eu recebi o convite
                <View style={styles.centerBox}>
                  <MaterialIcons name="mail" size={30} color="#2A9D8F" />
                  <Text style={[styles.statusText, { color: Cores.texto }]}>
                    Você recebeu um convite para Conta Conjunta de:
                  </Text>
                  <Text style={[styles.emailText, { color: Cores.texto }]}>
                    Seu parceiro(a)
                  </Text>
                  <View style={styles.rowBtns}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          flex: 1,
                          backgroundColor: "#E76F51",
                          marginRight: 10,
                        },
                      ]}
                      onPress={() =>
                        deletarParceria("Deseja recusar o convite?")
                      }
                    >
                      <Text style={styles.actionBtnText}>Recusar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1 }]}
                      onPress={aceitarConvite}
                    >
                      <Text style={styles.actionBtnText}>Aceitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : (
              // ESTADO 3: PARCERIA ACEITA!
              <View style={styles.centerBox}>
                <MaterialIcons name="favorite" size={40} color="#E76F51" />
                <Text
                  style={[
                    styles.statusText,
                    { color: Cores.texto, marginTop: 10 },
                  ]}
                >
                  Contas vinculadas com sucesso!
                </Text>
                <Text
                  style={[
                    styles.helpText,
                    {
                      color: Cores.secundario,
                      textAlign: "center",
                      marginTop: 5,
                    },
                  ]}
                >
                  Agora você verá a opção "Compartilhar" ao criar uma Conta Nova
                  ou Caixinha.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#E76F51",
                      marginTop: 20,
                    },
                  ]}
                  onPress={() =>
                    deletarParceria(
                      "Tem certeza que deseja desfazer o vínculo com seu parceiro(a)? As contas compartilhadas se tornarão privadas.",
                    )
                  }
                >
                  <Text style={[styles.actionBtnText, { color: "#E76F51" }]}>
                    Desfazer Vínculo
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* BOTÃO DE SAIR */}
          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: Cores.borda }]}
            onPress={handleLogout}
          >
            <MaterialIcons name="logout" size={24} color="#E76F51" />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: 30, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 10,
    marginLeft: 5,
    letterSpacing: 1,
  },
  configGroup: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  configLeft: { flexDirection: "row", alignItems: "center" },
  configText: { fontSize: 16, fontWeight: "600", marginLeft: 15 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    marginTop: 30,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(231, 111, 81, 0.1)",
  },
  logoutText: {
    color: "#E76F51",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },

  // Estilos da Conta Conjunta
  helpText: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 15,
  },
  actionBtn: {
    backgroundColor: "#2A9D8F",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  centerBox: { alignItems: "center", paddingVertical: 10 },
  statusText: { fontSize: 15, marginTop: 10, textAlign: "center" },
  emailText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
    marginBottom: 15,
  },
  rowBtns: { flexDirection: "row", width: "100%" },
});
