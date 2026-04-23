import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as Updates from "expo-updates";
import React, {
  Component,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

// ERROR BOUNDARY
class ErrorBoundary extends Component<{ children: ReactNode }, { temErro: boolean }> {
  state = { temErro: false };
  static getDerivedStateFromError() { return { temErro: true }; }
  render() {
    if (this.state.temErro) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212", padding: 30 }}>
          <MaterialIcons name="error-outline" size={64} color="#E76F51" />
          <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "bold", marginTop: 16, textAlign: "center" }}>
            Algo deu errado
          </Text>
          <Text style={{ color: "#AAA", fontSize: 14, marginTop: 8, textAlign: "center" }}>
            Feche e abra o aplicativo novamente. Se o problema persistir, contacte o suporte.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: "#2A9D8F", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => this.setState({ temErro: false })}
          >
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export const ThemeContext = createContext({
  isDark: false,
  toggleTheme: async () => {},
  isBiometricEnabled: false,
  toggleBiometric: async (_value: boolean) => {},
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
  const [session, setSession] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Intercepta deep links do email (recuperação de senha e confirmação de conta)
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    const fragment = url.split("#")[1];
    if (!fragment) return;
    const params = Object.fromEntries(new URLSearchParams(fragment));
    if (params.access_token && params.refresh_token) {
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      }).then(() => {
        if (params.type === "signup") {
          router.replace("/email-confirmed" as any);
        }
      });
    }
  }, [url]);

  // Verifica atualizações OTA ao abrir o app
  useEffect(() => {
    async function verificarAtualizacao() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert("Nova Atualização!", "Baixando as novidades do FinFlow...", [{ text: "Aguarde..." }]);
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "Sucesso!",
            "O aplicativo será reiniciado para aplicar as melhorias.",
            [{ text: "OK", onPress: () => Updates.reloadAsync() }],
          );
        }
      } catch (error) {
        console.log("Erro ao buscar atualizações:", error);
      }
    }
    if (!__DEV__) verificarAtualizacao();
  }, []);

  // Inicializa sessão e escuta mudanças de autenticação
  useEffect(() => {
    carregarConfiguracoes();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password" as any);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Guarda de rotas: redireciona conforme estado de autenticação
  useEffect(() => {
    if (!isReady || !isAuthReady) return;

    const seg = segments[0] as string;
    const inAuthGroup = seg === "login";
    const inSpecialFlow = seg === "reset-password" || seg === "email-confirmed";

    if (!session && !inAuthGroup && !inSpecialFlow) {
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
    } catch {
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

  if (!isReady || !isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#121212" : "#FFF" }}>
        <ActivityIndicator size="large" color="#2A9D8F" />
      </View>
    );
  }

  if (session && isBiometricEnabled && !isUnlocked) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: isDark ? "#121212" : "#FFF" }]}>
        <MaterialIcons name="lock" size={80} color="#2A9D8F" />
        <Text style={[styles.lockTitle, { color: isDark ? "#FFF" : "#1A1A1A" }]}>
          App Protegido
        </Text>
        <TouchableOpacity style={styles.button} onPress={autenticar}>
          <Text style={styles.buttonText}>Entrar com Biometria</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ isDark, toggleTheme, isBiometricEnabled, toggleBiometric, session }}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reset-password" />
            <Stack.Screen name="email-confirmed" />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  lockScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 22, fontWeight: "bold", marginVertical: 20 },
  button: { backgroundColor: "#2A9D8F", padding: 15, borderRadius: 10 },
  buttonText: { color: "#FFF", fontWeight: "bold" },
});
