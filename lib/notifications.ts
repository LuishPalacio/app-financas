import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function notificacoesEstaoAtivas(): Promise<boolean> {
  const val = await AsyncStorage.getItem("@notificacoes_enabled");
  return val === "true";
}

export async function agendarNotificacoesDoApp(
  transacoes: { status: string; data_vencimento: string; tipo: string }[]
) {
  if (Platform.OS === "web") return;
  const ativas = await notificacoesEstaoAtivas();
  if (!ativas) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencendoHoje = transacoes.filter((t) => {
    if (t.status !== "pendente") return false;
    const partes = t.data_vencimento.split("-");
    const dataT = new Date(
      parseInt(partes[0]),
      parseInt(partes[1]) - 1,
      parseInt(partes[2])
    );
    return dataT.getTime() === hoje.getTime();
  });

  const vencidas = transacoes.filter((t) => {
    if (t.status !== "pendente") return false;
    const partes = t.data_vencimento.split("-");
    const dataT = new Date(
      parseInt(partes[0]),
      parseInt(partes[1]) - 1,
      parseInt(partes[2])
    );
    return dataT < hoje;
  });

  const agora = new Date();

  // Notificação de vencidos (imediata se houver)
  if (vencidas.length > 0) {
    const disparo = new Date(agora.getTime() + 3000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔴 FinFlow — Lançamentos Vencidos",
        body: `Você tem ${vencidas.length} lançamento${vencidas.length > 1 ? "s" : ""} vencido${vencidas.length > 1 ? "s" : ""}. Regularize agora!`,
      },
      trigger: disparo,
    });
  }

  // Notificações de vencendo hoje
  if (vencendoHoje.length > 0) {
    const despesas = vencendoHoje.filter((t) => t.tipo === "despesa").length;
    const receitas = vencendoHoje.filter((t) => t.tipo === "receita").length;
    const partes: string[] = [];
    if (despesas > 0) partes.push(`${despesas} despesa${despesas > 1 ? "s" : ""}`);
    if (receitas > 0) partes.push(`${receitas} receita${receitas > 1 ? "s" : ""}`);
    const corpo = `Você tem ${partes.join(" e ")} vencendo hoje. Não esqueça!`;

    const hora8 = new Date(agora);
    hora8.setHours(8, 0, 0, 0);
    if (hora8 > agora) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "📅 FinFlow — Vencimento Hoje", body: corpo },
        trigger: hora8,
      });
    }

    const hora19 = new Date(agora);
    hora19.setHours(19, 0, 0, 0);
    if (hora19 > agora) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "⏰ FinFlow — Lembrete de Hoje", body: corpo },
        trigger: hora19,
      });
    }
  }

  // Notificação semanal toda sexta às 9h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📊 FinFlow — Revisão Semanal",
      body: "Mantenha suas contas em dia! Abra o FinFlow para conferir seus lançamentos.",
    },
    trigger: {
      weekday: 6, // Friday
      hour: 9,
      minute: 0,
      repeats: true,
    } as any,
  });
}
