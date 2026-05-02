import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Importação lazy para não travar o app se o módulo falhar
let Notif: any = null;
try {
  Notif = require("expo-notifications");
  Notif.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // expo-notifications não disponível — modo silencioso
}

export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  if (!Notif || Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notif.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notif.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function notificacoesEstaoAtivas(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem("@notificacoes_enabled");
    return val === "true";
  } catch {
    return false;
  }
}

export async function notificacoesEstaoAtivasPara(userId: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(`@notificacoes_enabled_${userId}`);
    return val === "true";
  } catch {
    return false;
  }
}

export async function agendarNotificacoesDoApp(
  transacoes: { status: string; data_vencimento: string; tipo: string }[],
  userId: string
) {
  if (!Notif || Platform.OS === "web") return;
  try {
    const ativas = await notificacoesEstaoAtivasPara(userId);
    if (!ativas) return;

    await Notif.cancelAllScheduledNotificationsAsync();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencendoHoje = transacoes.filter((t) => {
      if (t.status !== "pendente") return false;
      const p = (t.data_vencimento || "").split("-");
      if (p.length < 3) return false;
      const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
      return d.getTime() === hoje.getTime();
    });

    const vencidas = transacoes.filter((t) => {
      if (t.status !== "pendente") return false;
      const p = (t.data_vencimento || "").split("-");
      if (p.length < 3) return false;
      const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
      return d < hoje;
    });

    const agora = new Date();

    // Notificação imediata de vencidos (3s após app abrir)
    if (vencidas.length > 0) {
      await Notif.scheduleNotificationAsync({
        content: {
          title: "🔴 FinFlow — Lançamentos Vencidos",
          body: `Você tem ${vencidas.length} lançamento${vencidas.length > 1 ? "s" : ""} vencido${vencidas.length > 1 ? "s" : ""}. Regularize agora!`,
        },
        trigger: { seconds: 3 },
      });
    }

    // Notificações diárias com conteúdo personalizado
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
        const seg8 = Math.floor((hora8.getTime() - agora.getTime()) / 1000);
        await Notif.scheduleNotificationAsync({
          content: { title: "📅 FinFlow — Vencimento Hoje", body: corpo },
          trigger: { seconds: seg8 },
        });
      }

      const hora19 = new Date(agora);
      hora19.setHours(19, 0, 0, 0);
      if (hora19 > agora) {
        const seg19 = Math.floor((hora19.getTime() - agora.getTime()) / 1000);
        await Notif.scheduleNotificationAsync({
          content: { title: "⏰ FinFlow — Lembrete de Hoje", body: corpo },
          trigger: { seconds: seg19 },
        });
      }
    }

    // Notificações diárias ao meio-dia com mensagens variadas (próximos 7 dias)
    const mensagensNoon = [
      "Olha seu extrato! Lembre-se de registrar todas as suas transações.",
      "Mantenha o controle das suas finanças. Confira seus lançamentos agora!",
      "Hora de verificar sua situação financeira. Abra o FinFlow!",
      "Registre seus gastos enquanto estão frescos na memória.",
      "Você está no controle das suas finanças? Confira agora no FinFlow!",
      "Pequenos registros fazem grandes diferenças. Abra o FinFlow!",
      "Faça uma pausa e confira seu saldo no FinFlow.",
    ];
    for (let dia = 0; dia < 7; dia++) {
      const alvo = new Date(agora);
      alvo.setDate(alvo.getDate() + dia);
      alvo.setHours(12, 0, 0, 0);
      if (alvo <= agora) continue;
      const segundos = Math.floor((alvo.getTime() - agora.getTime()) / 1000);
      const idx = alvo.getDay() % mensagensNoon.length;
      await Notif.scheduleNotificationAsync({
        content: {
          title: "📊 FinFlow — Revisão Diária",
          body: mensagensNoon[idx],
        },
        trigger: { seconds: segundos },
      });
    }
  } catch (e) {
    console.log("Erro ao agendar notificações:", e);
  }
}
