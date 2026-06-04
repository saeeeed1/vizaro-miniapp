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

  if (!user) {
    throw new AuthError("Foydalanuvchi topilmadi.");
  }

  const employee = store.employees.find((item) => item.userId === user.id && item.isActive);

  return {
    id: user.id,
    telegramId: user.telegramId,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    employeeId: employee?.id ?? null,
    isDemo: IS_DEMO_MODE
  };
}

export function resolveSession(headers: Headers): SessionPayload {
  const store = getStore();
  const requestedDemoUserId = headers.get(DEMO_USER_HEADER);
  const initData = headers.get(TELEGRAM_INIT_DATA_HEADER);
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";

  if (IS_DEMO_MODE && requestedDemoUserId) {
    return {
      user: toSessionUser(requestedDemoUserId),
      config: store.salaryConfig,
      availableUsers: store.users.map((user) => {
        const employee = store.employees.find((item) => item.userId === user.id && item.isActive);
        return {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          employeeId: employee?.id ?? null
        };
      })
    };
  }

  if (initData) {
    const telegramUser = validateTelegramInitData(initData, botToken);
    if (!telegramUser) {
      throw new AuthError("Telegram init data tasdiqlanmadi.");
    }

    const matched = store.users.find((user) => user.telegramId === telegramUser.id);
    if (!matched) {
      throw new AuthError("Bu Telegram foydalanuvchisi tizimga biriktirilmagan.", 403);
    }

    return {
      user: toSessionUser(matched.id),
      config: store.salaryConfig
    };
  }

  if (IS_DEMO_MODE) {
    const fallbackAdmin = store.users.find((user) => user.role === "ADMIN") ?? store.users[0];
    return {
      user: toSessionUser(fallbackAdmin.id),
      config: store.salaryConfig,
      availableUsers: store.users.map((user) => {
        const employee = store.employees.find((item) => item.userId === user.id && item.isActive);
        return {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          employeeId: employee?.id ?? null
        };
      })
    };
  }

  throw new AuthError("Sessiya topilmadi.");
}
