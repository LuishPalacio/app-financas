import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Alert, useColorScheme } from "react-native";
import "react-native-reanimated";
import { initializeDatabase } from "../database/initDB";

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Updates from "expo-updates"; // <-- MOTOR DE ATUALIZAÇÕES ADICIONADO
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
  session: null as any,
});

export const useAppTheme = () => useContext(ThemeContext);

export default function RootLayout() {
  const systemTheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [isDark, setIsDark] = useState(systemTheme === "dark");
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ESTADOS DO SUPABASE
  const [session, setSession] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // 1. OLHEIRO DE ATUALIZAÇÕES (OTA Updates)
  useEffect(() => {
    async function verificarAtualizacao() {
      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          Alert.alert(
            "Nova Atualização!",
            "Baixando as novidades do LHS Finanças...",
            [{ text: "Aguarde..." }],
          );

          await Updates.fetchUpdateAsync();

          Alert.alert(
            "Sucesso!",
            "O aplicativo será reiniciado para aplicar as melhorias.",
            [{ text: "OK", onPress: () => Updates.reloadAsync() }],
          );
        }
      } catch (error) {
        console.log("Erro ao buscar atualizações: ", error);
      }
    }

    if (!__DEV__) {
      verificarAtualizacao();
    }
  }, []);

  // 2. CONFIGURAÇÕES INICIAIS E SUPABASE
  useEffect(() => {
    carregarConfiguracoes();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Boa prática: limpa o escutador quando o componente for desmontado
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // O SEGURANÇA EM AÇÃO: Fica de olho nas mudanças de tela e de sessão
  useEffect(() => {
    if (!isReady || !isAuthReady) return;

    const inAuthGroup = segments[0] === "login";

    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
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
