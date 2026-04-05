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
      console.log("[ZaloClient] Using valid token from Database.");
      this.accessToken = config.accessToken;
      this.refreshToken = config.refreshToken;
      this.expiresAt = config.expiresAt;
      return this.accessToken;
    }

    // 3. Ưu tiên: Nếu ENV có token MỚI hơn cái đang có trong memory/DB (giả sử user vừa cập nhật .env)
    const envAt = process.env.ZALO_ACCESS_TOKEN;
    const envRt = process.env.ZALO_REFRESH_TOKEN;

    if (envAt && envAt !== this.accessToken && envAt !== config?.accessToken) {
      console.log(
        "[ZaloClient] New token detected in ENV. Updating storage...",
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
        return await this.refreshAccessToken(refreshKey);
      } catch (error) {
        console.error("[ZaloClient] Automated periodic refresh failed:", error);
      }
    }

    // Final fallback
    if (this.accessToken) return this.accessToken;

    if (envAt) {
      console.warn(
        "[ZaloClient] Falling back to ENV Access Token without Refresh capability.",
      );
      this.accessToken = envAt;
      return envAt;
    }

    throw new Error(
      "Không tìm thấy Zalo Access Token hợp lệ. Vui lòng kiểm tra ZALO_ACCESS_TOKEN và ZALO_REFRESH_TOKEN.",
    );
  }

  /**
   * Gọi API Zalo để đổi Refresh Token lấy cặp Token mới
   */
  async refreshAccessToken(currentRefreshToken: string): Promise<string> {
    console.log("[ZaloClient] Requesting new access token from Zalo OAuth...");
    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trong Environment Variables.",
      );
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
      console.error("[ZaloClient] Zalo OAuth Refresh Error:", result);
      throw new Error(`Zalo Refresh Failed: ${result.message || result.error}`);
    }

    const newAccessToken = result.access_token;
    const newRefreshToken = result.refresh_token;
    const expiresIn = parseInt(result.expires_in) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Lưu vào Database để các instance khác dùng chung
    await setZaloConfig({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    });

    this.accessToken = newAccessToken;
    this.refreshToken = newRefreshToken;
    this.expiresAt = expiresAt;

    console.log(
      `[ZaloClient] Token refreshed successfully. Valid until: ${expiresAt.toISOString()}`,
    );
    return newAccessToken;
  }

  /**
   * Gửi tin nhắn văn bản
   */
  async sendText(userId: string, text: string) {
    const token = await this.ensureValidToken();

    const payload = {
      recipient: {
        user_id: userId,
      },
      message: {
        text: text,
      },
    };

    let result = await this.post(
      "https://openapi.zalo.me/v2.0/oa/message",
      payload,
      token,
    );

    // Xử lý lỗi Token hết hạn bất ngờ (-216: Access token invalid)
    if (result.error === -216 || result.error === -201) {
      console.warn(
        "[ZaloClient] Token invalid/expired. Attempting real-time refresh...",
      );
      const config = await getZaloConfig();
      const refreshKey = config?.refreshToken || process.env.ZALO_REFRESH_TOKEN;

      if (refreshKey) {
        try {
          const newToken = await this.refreshAccessToken(refreshKey);
          console.log("[ZaloClient] Retrying send message with new token...");
          result = await this.post(
            "https://openapi.zalo.me/v2.0/oa/message",
            payload,
            newToken,
          );
        } catch (refreshError: any) {
          console.error(
            "[ZaloClient] Critical: Refresh failed during retry:",
            refreshError.message,
          );
        }
      } else {
        console.error(
          "[ZaloClient] No Refresh Token found in DB or ENV. Cannot auto-refresh.",
        );
      }
    }

    return result;
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
