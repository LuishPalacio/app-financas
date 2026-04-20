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

export default function LoginScreen() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [isLogin, setIsLogin] = useState(true);
  const [isRecuperandoSenha, setIsRecuperandoSenha] = useState(false);

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmSenha, setMostrarConfirmSenha] = useState(false);

  async function signInWithEmail() {
    if (!email || !password)
      return Alert.alert("Aviso", "Preencha email e senha.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert("Erro ao entrar", error.message);
    else router.replace("/(tabs)");
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!nome || !email || !password)
      return Alert.alert("Aviso", "Preencha todos os campos obrigatórios (Nome, E-mail e Senha).");

    if (password !== confirmPassword)
      return Alert.alert("Senhas diferentes", "A senha e a confirmação não conferem. Verifique e tente novamente.");

    if (password.length < 6)
      return Alert.alert("Senha fraca", "A senha deve ter pelo menos 6 caracteres.");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          nome_usuario: nome,
          telefone: telefone.trim(),
        },
      },
    });

    if (error) {
      Alert.alert("Erro ao criar conta", error.message);
    } else {
      Alert.alert(
        "Conta Criada com Sucesso! 🎉",
        `Bem-vindo(a), ${nome}! A sua conta foi registrada nas nuvens.\n\nSe a confirmação por e-mail estiver ativada, verifique a sua caixa. Caso contrário, já pode fazer o login!`,
      );
      setIsLogin(true);
      setPassword("");
      setConfirmPassword("");
      setNome("");
      setTelefone("");
    }
    setLoading(false);
  }

  async function recuperarSenha() {
    if (!email)
      return Alert.alert("Aviso", "Digite o seu e-mail no campo acima para enviarmos o link de recuperação.");

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert("Erro", error.message);
    } else {
      Alert.alert(
        "E-mail Enviado! 📩",
        "Verifique a sua caixa de entrada (e o spam). Enviámos um link seguro para redefinir a sua senha.",
      );
      setIsRecuperandoSenha(false);
    }
  }

  const trocarTela = () => {
    if (isRecuperandoSenha) {
      setIsRecuperandoSenha(false);
    } else {
      setIsLogin(!isLogin);
      setPassword("");
      setConfirmPassword("");
      setMostrarSenha(false);
      setMostrarConfirmSenha(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <MaterialIcons
              name={isRecuperandoSenha ? "lock-reset" : "account-balance-wallet"}
              size={60}
              color="#2A9D8F"
            />
          </View>

          <Text style={styles.title}>FinFlow</Text>
          <Text style={styles.subtitle}>
            {isRecuperandoSenha
              ? "Recuperação de Acesso"
              : isLogin
                ? "Bem-vindo de volta!"
                : "Crie sua conta para começar"}
          </Text>

          {/* NOME — só no cadastro */}
          {!isLogin && !isRecuperandoSenha && (
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Seu Nome (Ex: Luis)"
                placeholderTextColor="#999"
                onChangeText={setNome}
                value={nome}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* EMAIL — sempre visível */}
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Seu E-mail"
              placeholderTextColor="#999"
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* TELEFONE — só no cadastro */}
          {!isLogin && !isRecuperandoSenha && (
            <View style={styles.inputContainer}>
              <MaterialIcons name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Telefone (Ex: 11 99999-9999)"
                placeholderTextColor="#999"
                onChangeText={setTelefone}
                value={telefone}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* SENHA — visível quando não está recuperando */}
          {!isRecuperandoSenha && (
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Sua Senha"
                placeholderTextColor="#999"
                onChangeText={setPassword}
                value={password}
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setMostrarSenha((v) => !v)} style={styles.olhoBtn}>
                <MaterialIcons
                  name={mostrarSenha ? "visibility-off" : "visibility"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* CONFIRMAR SENHA — só no cadastro */}
          {!isLogin && !isRecuperandoSenha && (
            <>
              <View style={[
                styles.inputContainer,
                confirmPassword.length > 0 && password !== confirmPassword && styles.inputContainerErro,
              ]}>
                <MaterialIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar Senha"
                  placeholderTextColor="#999"
                  onChangeText={setConfirmPassword}
                  value={confirmPassword}
                  secureTextEntry={!mostrarConfirmSenha}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setMostrarConfirmSenha((v) => !v)} style={styles.olhoBtn}>
                  <MaterialIcons
                    name={mostrarConfirmSenha ? "visibility-off" : "visibility"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.erroSenha}>As senhas não conferem</Text>
              )}
              {confirmPassword.length > 0 && password === confirmPassword && (
                <Text style={styles.senhaOk}>Senhas conferem ✓</Text>
              )}
            </>
          )}

          {/* BOTÃO PRINCIPAL */}
          <TouchableOpacity
            style={[styles.mainButton, loading && styles.buttonDisabled]}
            onPress={
              isRecuperandoSenha
                ? recuperarSenha
                : isLogin
                  ? signInWithEmail
                  : signUpWithEmail
            }
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.mainButtonText}>
                {isRecuperandoSenha
                  ? "Enviar Link de Recuperação"
                  : isLogin
                    ? "Entrar"
                    : "Criar Conta"}
              </Text>
            )}
          </TouchableOpacity>

          {/* ESQUECI A SENHA — só no login */}
          {isLogin && !isRecuperandoSenha && (
            <TouchableOpacity
              style={{ marginTop: 15, alignItems: "center" }}
              onPress={() => setIsRecuperandoSenha(true)}
            >
              <Text style={{ color: "#E76F51", fontSize: 14, fontWeight: "bold" }}>
                Esqueci minha senha
              </Text>
            </TouchableOpacity>
          )}

          {/* TROCAR TELA */}
          <TouchableOpacity style={styles.switchButton} onPress={trocarTela}>
            <Text style={styles.switchButtonText}>
              {isRecuperandoSenha
                ? "Voltar para o Login"
                : isLogin
                  ? "Não tem uma conta? Crie aqui."
                  : "Já tem uma conta? Faça login."}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#1E1E1E",
    padding: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  iconContainer: { alignItems: "center", marginBottom: 20 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#AAA",
    textAlign: "center",
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  inputContainerErro: {
    borderColor: "#E76F51",
  },
  inputIcon: { paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 15, color: "#FFF", fontSize: 16 },
  olhoBtn: { paddingHorizontal: 15, paddingVertical: 15 },
  erroSenha: {
    color: "#E76F51",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 5,
  },
  senhaOk: {
    color: "#2A9D8F",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 5,
  },
  mainButton: {
    backgroundColor: "#2A9D8F",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: { backgroundColor: "#444" },
  mainButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  switchButton: { marginTop: 25, alignItems: "center" },
  switchButtonText: { color: "#F4A261", fontSize: 14, fontWeight: "600" },
});
