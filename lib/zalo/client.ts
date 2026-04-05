export class ZaloClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get apiUrl() {
    // Zalo OA OpenAPI v2.0 endpoint for messages
    return "https://openapi.zalo.me/v2.0/oa/message";
  }

  async sendText(userId: string, text: string) {
    const payload = {
      recipient: {
        user_id: userId,
      },
      message: {
        text: text,
      },
    };
    return this.post(this.apiUrl, payload);
  }

  private async post(url: string, data: any) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: this.accessToken,
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

export const zaloClient = new ZaloClient(process.env.ZALO_ACCESS_TOKEN || "");
