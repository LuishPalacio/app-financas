import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-reanimated";
import { initializeDatabase } from "../database/initDB";

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase"; // <-- NOSSO CABO DA NUVEM AQUI!

// CONTEXTO GLOBAL (AGORA GUARDA A SESSÃO DO USUÁRIO TAMBÉM)
export const ThemeContext = createContext({
  isDark: false,
  toggleTheme: async () => {},
  isBiometricEnabled: false,
  toggleBiometric: async (value: boolean) => {},
  session: null as any, // Adicionamos a sessão aqui para as abas saberem quem está logado
});

export const useAppTheme = () => useContext(ThemeContext);

export default function RootLayout() {
  const systemTheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments(); // Lê a página em que estamos agora

  const [isDark, setIsDark] = useState(systemTheme === "dark");
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ESTADOS DO SUPABASE
  const [session, setSession] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();

    // 1. O RADAR DO SUPABASE (Verifica se já tem alguém salvo na memória ao abrir)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthReady(true);
    });

    // 2. Fica escutando se alguém fez login ou clicou em "Sair"
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // O SEGURANÇA EM AÇÃO: Fica de olho nas mudanças de tela e de sessão
  useEffect(() => {
    if (!isReady || !isAuthReady) return;

    // Descobre se estamos na página de login
    const inAuthGroup = segments[0] === "login";

    if (!session && !inAuthGroup) {
      // Se NÃO tem login e tentou entrar no app, expulsa para o Login!
      router.replace("/login");
    } else if (session && inAuthGroup) {
      // Se JÁ TEM login e tentou voltar pro Login, manda pra dentro do app!
      router.replace("/(tabs)");
    }
  }, [session, isReady, isAuthReady, segments]);

  const carregarConfiguracoes = async () => {
    try {
      const temaSalvo = await AsyncStorage.getItem("@dark_mode");
      if (temaSalvo !== null) setIsDark(temaSalvo === "true");

      const biometriaSalva = await AsyncStorage.getItem("@biometric_enabled");
      const biometriaAtiva = biometriaSalva === "true";
      setIsBiometricEnabled(biometriaAtiva);

      if (biometriaAtiva) {
        verificarBiometria();
      } else {
        setIsUnlocked(true);
      }
    } catch (e) {
      setIsUnlocked(true);
    } finally {
      setIsReady(true);
    }
  };

  const verificarBiometria = async () => {
    const temHardware = await LocalAuthentication.hasHardwareAsync();
    const temBiometria = await LocalAuthentication.isEnrolledAsync();

    if (temHardware && temBiometria) {
      autenticar();
    } else {
      setIsUnlocked(true);
    }
  };

  const autenticar = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Acesse sua Carteira",
      fallbackLabel: "Usar senha padrão",
    });
    if (result.success) setIsUnlocked(true);
  };

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    await AsyncStorage.setItem("@dark_mode", newValue ? "true" : "false");
  };

  const toggleBiometric = async (value: boolean) => {
    setIsBiometricEnabled(value);
    await AsyncStorage.setItem("@biometric_enabled", value ? "true" : "false");
    if (value) setIsUnlocked(true);
  };

  // TELA DE CARREGAMENTO (Enquanto o segurança pensa)
  if (!isReady || !isAuthReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#121212" : "#FFF",
        }}
      >
        <ActivityIndicator size="large" color="#2A9D8F" />
      </View>
    );
  }

  // TELA DE BLOQUEIO BIOMÉTRICO (Só mostra se tiver logado E com a biometria ativa)
  if (session && isBiometricEnabled && !isUnlocked) {
    return (
      <View
        style={[
          styles.lockScreen,
          { backgroundColor: isDark ? "#121212" : "#FFF" },
        ]}
      >
        <MaterialIcons name="lock" size={80} color="#2A9D8F" />
        <Text
          style={[styles.lockTitle, { color: isDark ? "#FFF" : "#1A1A1A" }]}
        >
          App Protegido
        </Text>
        <TouchableOpacity style={styles.button} onPress={autenticar}>
          <Text style={styles.buttonText}>Entrar com Biometria</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // O APLICATIVO EM SI
  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme,
        isBiometricEnabled,
        toggleBiometric,
        session,
      }}
    >
      <SQLiteProvider databaseName="quimera_v4.db" onInit={initializeDatabase}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </SQLiteProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  lockScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 22, fontWeight: "bold", marginVertical: 20 },
  button: { backgroundColor: "#2A9D8F", padding: 15, borderRadius: 10 },
  buttonText: { color: "#FFF", fontWeight: "bold" },
});
