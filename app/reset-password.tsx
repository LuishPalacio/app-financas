import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function ResetPasswordScreen() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarNova, setMostrarNova] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);

  async function redefinirSenha() {
    if (!novaSenha || !confirmarSenha)
      return Alert.alert("Aviso", "Preencha os dois campos.");
    if (novaSenha.length < 6)
      return Alert.alert("Senha fraca", "A senha deve ter pelo menos 6 caracteres.");
    if (novaSenha !== confirmarSenha)
      return Alert.alert("Senhas diferentes", "As senhas não conferem.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoading(false);

    if (error) {
      Alert.alert("Erro", error.message);
    } else {
      Alert.alert(
        "Senha Redefinida! ✓",
        "Sua senha foi atualizada com sucesso. Você já pode usar o app normalmente.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock-reset" size={72} color="#2A9D8F" />
        </View>

        <Text style={styles.title}>Nova Senha</Text>
        <Text style={styles.subtitle}>
          Escolha uma senha segura para a sua conta.
        </Text>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nova Senha"
            placeholderTextColor="#999"
            onChangeText={setNovaSenha}
            value={novaSenha}
            secureTextEntry={!mostrarNova}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setMostrarNova((v) => !v)} style={styles.olhoBtn}>
            <MaterialIcons
              name={mostrarNova ? "visibility-off" : "visibility"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.inputContainer,
            confirmarSenha.length > 0 &&
              novaSenha !== confirmarSenha &&
              styles.inputErro,
          ]}
        >
          <MaterialIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirmar Nova Senha"
            placeholderTextColor="#999"
            onChangeText={setConfirmarSenha}
            value={confirmarSenha}
            secureTextEntry={!mostrarConfirmar}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setMostrarConfirmar((v) => !v)} style={styles.olhoBtn}>
            <MaterialIcons
              name={mostrarConfirmar ? "visibility-off" : "visibility"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {confirmarSenha.length > 0 && novaSenha !== confirmarSenha && (
          <Text style={styles.erroTexto}>As senhas não conferem</Text>
        )}
        {confirmarSenha.length > 0 && novaSenha === confirmarSenha && (
          <Text style={styles.okTexto}>Senhas conferem ✓</Text>
        )}

        <TouchableOpacity
          style={[styles.botao, loading && styles.botaoDesabilitado]}
          onPress={redefinirSenha}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.botaoTexto}>Redefinir Senha</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  iconWrap: { alignItems: "center", marginBottom: 20 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#AAA",
    textAlign: "center",
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  inputErro: { borderColor: "#E76F51" },
  inputIcon: { paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 15, color: "#FFF", fontSize: 16 },
  olhoBtn: { paddingHorizontal: 15, paddingVertical: 15 },
  erroTexto: { color: "#E76F51", fontSize: 12, marginTop: -6, marginBottom: 10, marginLeft: 5 },
  okTexto: { color: "#2A9D8F", fontSize: 12, marginTop: -6, marginBottom: 10, marginLeft: 5 },
  botao: {
    backgroundColor: "#2A9D8F",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  botaoDesabilitado: { backgroundColor: "#444" },
  botaoTexto: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});
