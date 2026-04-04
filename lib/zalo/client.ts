export class ZaloClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get apiUrl() {
    return `https://bot-api.zaloplatforms.com/bot${this.accessToken}`;
  }

  async sendText(chatId: string, text: string) {
    const payload = {
      chat_id: chatId,
      text: text,
    };
    return this.post(`${this.apiUrl}/sendMessage`, payload);
  }

  private async post(url: string, data: any) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Zalo API Error:", result);
    }
    return result;
  }
}

export const zaloClient = new ZaloClient(process.env.ZALO_ACCESS_TOKEN || "");
