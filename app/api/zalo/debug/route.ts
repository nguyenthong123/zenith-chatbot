import { type NextRequest, NextResponse } from "next/server";
import { getZaloConfig } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  try {
    const config = await getZaloConfig();
    const envAt = process.env.ZALO_ACCESS_TOKEN;
    const envRt = process.env.ZALO_REFRESH_TOKEN;
    const appId = process.env.ZALO_APP_ID;

    const data = {
      status: "ok",
      database: config
        ? {
            hasAccessToken: !!config.accessToken,
            accessTokenPreview: config.accessToken
              ? `${config.accessToken.substring(0, 10)}...`
              : null,
            hasRefreshToken: !!config.refreshToken,
            refreshTokenPreview: config.refreshToken
              ? `${config.refreshToken.substring(0, 5)}...`
              : null,
            expiresAt: config.expiresAt.toISOString(),
            isExpired: config.expiresAt.getTime() < Date.now(),
          }
        : "No config in DB",
      environment: {
        hasAppId: !!appId,
        hasAccessToken: !!envAt,
        hasRefreshToken: !!envRt,
        accessTokenPreview: envAt ? `${envAt.substring(0, 10)}...` : null,
      },
      serverTime: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 },
    );
  }
}
