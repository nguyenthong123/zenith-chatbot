import { getZaloConfig, setZaloConfig } from "../db/queries";

export class ZaloClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: Date | null = null;

  constructor() {
    // Singleton instance
  }

  /**
   * Đảm bảo chúng ta luôn có một access token hợp lệ.
   * Ưu tiên: Memory > Database > Refresh > Env (lần đầu)
   */
  private async ensureValidToken(): Promise<string> {
    const now = new Date();
    const buffer = 5 * 60 * 1000;

    // 1. Kiểm tra trong bộ nhớ
    if (
      this.accessToken &&
      this.expiresAt &&
      this.expiresAt.getTime() > now.getTime() + buffer
    ) {
      return this.accessToken;
    }

    // 2. Thử lấy từ Database
    const config = await getZaloConfig();
    if (config && config.expiresAt.getTime() > now.getTime() + buffer) {
      this.accessToken = config.accessToken;
      this.refreshToken = config.refreshToken;
      this.expiresAt = config.expiresAt;
      console.log(
        `[ZaloClient] Using token from DB (Preview: ${this.accessToken?.substring(0, 8)}...)`,
      );
      return this.accessToken;
    }

    // 3. Ưu tiên: Nếu ENV có token MỚI hơn cái đang có (user vừa cập nhật Dashboard Vercel)
    const envAt = process.env.ZALO_ACCESS_TOKEN;
    const envRt = process.env.ZALO_REFRESH_TOKEN;

    if (envAt && envAt !== this.accessToken && envAt !== config?.accessToken) {
      console.log(
        `[ZaloClient] New token detected in ENV (Preview: ${envAt.substring(0, 8)}...). Updating storage...`,
      );
      const initialExpiresAt = new Date(Date.now() + 3600 * 1000); // 1h

      await setZaloConfig({
        accessToken: envAt,
        refreshToken: envRt || config?.refreshToken || "",
        expiresAt: initialExpiresAt,
      });

      this.accessToken = envAt;
      this.refreshToken = envRt || config?.refreshToken || null;
      this.expiresAt = initialExpiresAt;
      return this.accessToken;
    }

    // 4. Nếu token DB hết hạn nhưng có Refresh Token -> Tự refresh
    const refreshKey = config?.refreshToken || envRt;
    if (refreshKey) {
      try {
        console.log("[ZaloClient] Access token expired. Attempting refresh...");
        return await this.refreshAccessToken(refreshKey);
      } catch (error: any) {
        console.error(
          `[ZaloClient] Automated refresh failed: ${error.message}`,
        );
      }
    }

    // Final fallback
    if (this.accessToken) {
      console.warn(
        "[ZaloClient] Using expired memory token as fallback (no refresh key available).",
      );
      return this.accessToken;
    }

    if (envAt) {
      console.warn(
        "[ZaloClient] Using ENV Access Token without Refresh capability.",
      );
      this.accessToken = envAt;
      return envAt;
    }

    console.error(
      "[ZaloClient] CRITICAL: No valid tokens found and no Refresh Token (ZALO_REFRESH_TOKEN) is configured. The bot will not be able to reply until a new token is provided.",
    );

    throw new Error(
      "BOT_AUTH_ERROR: Missing Zalo Access Token or Refresh Token.",
    );
  }

  /**
   * Gọi API Zalo để đổi Refresh Token lấy cặp Token mới
   */
  async refreshAccessToken(currentRefreshToken: string): Promise<string> {
    console.log("[ZaloClient] Sending refresh request to Zalo...");
    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("Missing ZALO_APP_ID or ZALO_APP_SECRET in ENV.");
    }

    const response = await fetch("https://oauth.zalo.me/v2.0/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecret,
      },
      body: new URLSearchParams({
        refresh_token: currentRefreshToken,
        app_id: appId,
        grant_type: "refresh_token",
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("[ZaloClient] Refresh error from Zalo:", result);
      throw new Error(`Zalo Refresh Failed: ${result.message || result.error}`);
    }

    const newAccessToken = result.access_token;
    const newRefreshToken = result.refresh_token;
    const expiresIn = parseInt(result.expires_in) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Lưu vào Database
    await setZaloConfig({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    });

    this.accessToken = newAccessToken;
    this.refreshToken = newRefreshToken;
    this.expiresAt = expiresAt;

    console.log(
      `[ZaloClient] Token refreshed. Valid until: ${expiresAt.toLocaleString()}`,
    );
    return newAccessToken;
  }

  /**
   * Gửi tin nhắn văn bản
   */
  async sendText(userId: string, text: string) {
    try {
      const token = await this.ensureValidToken();

      const payload = {
        recipient: { user_id: userId },
        message: { text },
      };

      let result = await this.post(
        "https://openapi.zalo.me/v2.0/oa/message",
        payload,
        token,
      );

      // Retry once if token is rejected by API (-216: Invalid token)
      if (result.error === -216 || result.error === -201) {
        console.warn("[ZaloClient] Token rejected by API. Forcing refresh...");
        const config = await getZaloConfig();
        const refreshKey =
          config?.refreshToken || process.env.ZALO_REFRESH_TOKEN;

        if (refreshKey) {
          const newToken = await this.refreshAccessToken(refreshKey);
          result = await this.post(
            "https://openapi.zalo.me/v2.0/oa/message",
            payload,
            newToken,
          );
        } else {
          console.error(
            "[ZaloClient] No Refresh Token found. Cannot retry send.",
          );
        }
      }

      return result;
    } catch (err: any) {
      console.error(`[ZaloClient] Failed to send message: ${err.message}`);
      return { error: -1, message: err.message };
    }
  }

  private async post(url: string, data: any, token: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: token,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.error !== 0) {
      console.error(
        "[ZaloClient] Zalo API Error Response:",
        JSON.stringify(result, null, 2),
      );
    } else {
      console.log("[ZaloClient] Successfully sent message to Zalo");
    }
    return result;
  }
}

export const zaloClient = new ZaloClient();
