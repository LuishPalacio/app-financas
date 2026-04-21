import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function EmailConfirmedScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/login"), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <MaterialIcons name="check-circle" size={90} color="#2A9D8F" />
      <Text style={styles.title}>E-mail Confirmado!</Text>
      <Text style={styles.subtitle}>
        Sua conta foi verificada com sucesso.{"\n"}Agora é só fazer o login.
      </Text>
      <TouchableOpacity style={styles.botao} onPress={() => router.replace("/login")}>
        <Text style={styles.botaoTexto}>Ir para o Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#AAA",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  botao: {
    backgroundColor: "#2A9D8F",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  botaoTexto: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});
