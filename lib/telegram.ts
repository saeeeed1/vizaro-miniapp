import crypto from "node:crypto";

export interface TelegramAuthUser {
  id: string;
  username: string | null;
  fullName: string;
}

export function validateTelegramInitData(initData: string, botToken: string): TelegramAuthUser | null {
  if (!initData || !botToken) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const rawUser = params.get("user");

  if (!hash || !rawUser) {
    return null;
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const receivedBuffer = Buffer.from(hash, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser) as {
      id: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    return {
      id: String(parsedUser.id),
      username: parsedUser.username ?? null,
      fullName: [parsedUser.first_name, parsedUser.last_name].filter(Boolean).join(" ") || `Telegram ${parsedUser.id}`
    };
  } catch {
    return null;
  }
}
