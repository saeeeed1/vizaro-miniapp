import { DEMO_USER_HEADER, IS_DEMO_MODE, TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";
import { getStore } from "@/lib/store";
import { validateTelegramInitData } from "@/lib/telegram";
import type { SessionPayload, SessionUser } from "@/lib/types";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function toSessionUser(userId: string): SessionUser {
  const store = getStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new AuthError("Foydalanuvchi topilmadi.");
  const employee = store.employees.find((item) => item.userId === user.id && item.isActive);
  return {
    id: user.id,
    telegramId: user.telegramId,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    employeeId: employee?.id ?? null,
    isDemo: IS_DEMO_MODE,
  };
}

function extractRawTelegramUser(initData: string): { id: string; fullName: string; username: string | null } | null {
  try {
    const params = new URLSearchParams(initData);
    const rawUser = params.get("user");
    if (!rawUser) return null;
    const p = JSON.parse(rawUser) as { id?: number | string; first_name?: string; last_name?: string; username?: string };
    const id = String(p.id ?? "");
    if (!id) return null;
    return {
      id,
      fullName: [p.first_name, p.last_name].filter(Boolean).join(" ") || `Telegram ${id}`,
      username: p.username ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchBotSession(
  botApiUrl: string,
  telegramId: string,
  fallback: { fullName: string; username: string | null },
  config: SessionPayload["config"]
): Promise<SessionPayload> {
  try {
    const res = await fetch(
      `${botApiUrl.replace(/\/$/, "")}/api/me?user_id=${telegramId}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json() as {
        full_name?: string;
        username?: string;
        is_admin?: boolean;
        is_allowed?: boolean;
      };
      return {
        user: {
          id: `tg_${telegramId}`,
          telegramId,
          fullName: data.full_name ?? fallback.fullName,
          username: data.username ?? fallback.username,
          role: data.is_admin ? "ADMIN" : "EMPLOYEE",
          employeeId: null,
          isDemo: false,
        },
        config,
      };
    }
  } catch {
    // Bot API ulanmadi — fallback session ishlatiladi
  }
  // Bot API da topilmadi yoki xato: synthetic session (EMPLOYEE)
  return {
    user: {
      id: `tg_${telegramId}`,
      telegramId,
      fullName: fallback.fullName,
      username: fallback.username,
      role: "EMPLOYEE",
      employeeId: null,
      isDemo: false,
    },
    config,
  };
}

export async function resolveSession(headers: Headers): Promise<SessionPayload> {
  const store = getStore();
  const requestedDemoUserId = headers.get(DEMO_USER_HEADER);
  const initData = headers.get(TELEGRAM_INIT_DATA_HEADER);
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const botApiUrl = process.env.BOT_API_URL ?? "";

  // ── Demo mode: store foydalanuvchilari ───────────────────────────────────
  if (IS_DEMO_MODE && requestedDemoUserId) {
    return {
      user: toSessionUser(requestedDemoUserId),
      config: store.salaryConfig,
      availableUsers: store.users.map((user) => {
        const employee = store.employees.find((item) => item.userId === user.id && item.isActive);
        return { id: user.id, fullName: user.fullName, role: user.role, employeeId: employee?.id ?? null };
      }),
    };
  }

  // ── BOT_API_URL rejimi: store.users dan mustaqil ─────────────────────────
  if (!IS_DEMO_MODE && botApiUrl && initData) {
    const rawUser = extractRawTelegramUser(initData);
    if (!rawUser) throw new AuthError("Telegram foydalanuvchi ma'lumotlari noto'g'ri.");

    // Imzo tekshiruvi (token mavjud bo'lsa)
    if (botToken) {
      const validated = validateTelegramInitData(initData, botToken);
      if (!validated) throw new AuthError("Telegram init data tasdiqlanmadi.");
    }

    return fetchBotSession(botApiUrl, rawUser.id, rawUser, store.salaryConfig);
  }

  // ── Store rejimi (demo fallback yoki botApiUrl yo'q) ────────────────────
  if (initData) {
    const telegramUser = validateTelegramInitData(initData, botToken);
    if (telegramUser) {
      const matched = store.users.find((user) => user.telegramId === telegramUser.id);
      if (matched) return { user: toSessionUser(matched.id), config: store.salaryConfig };
      if (!IS_DEMO_MODE) throw new AuthError("Bu Telegram foydalanuvchisi tizimga biriktirilmagan.", 403);
    } else if (!IS_DEMO_MODE) {
      throw new AuthError("Telegram init data tasdiqlanmadi.");
    }
  }

  // ── Demo fallback (initData yo'q yoki validation muvaffaqiyatsiz) ────────
  if (IS_DEMO_MODE) {
    const fallbackAdmin = store.users.find((user) => user.role === "ADMIN") ?? store.users[0];
    return {
      user: toSessionUser(fallbackAdmin.id),
      config: store.salaryConfig,
      availableUsers: store.users.map((user) => {
        const employee = store.employees.find((item) => item.userId === user.id && item.isActive);
        return { id: user.id, fullName: user.fullName, role: user.role, employeeId: employee?.id ?? null };
      }),
    };
  }

  throw new AuthError("Sessiya topilmadi.");
}
