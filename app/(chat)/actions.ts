"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { titleModel } from "@/lib/ai/models";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  updateChatVisibilityById,
  upsertProduct,
} from "@/lib/db/queries";
import cloudinary from "@/lib/cloudinary";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text } = await generateText({
    model: getTitleModel(),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
    providerOptions: {
      gateway: { order: titleModel.gatewayOrder },
    },
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [message] = await getMessageById({ id });
  if (!message) {
    throw new Error("Message not found");
  }

  const chat = await getChatById({ id: message.chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await updateChatVisibilityById({ chatId, visibility });
}

export async function handleInteractiveProductUpload(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, message: "Bạn cần đăng nhập để thao tác!" };
  }

  const name = formData.get("name") as string;
  const sku = (formData.get("sku") as string) || "";
  const category = (formData.get("category") as string) || "";
  const note = (formData.get("note") as string) || "";
  const imagesBase64 = formData.getAll("imagesBase64") as string[];

  if (!name || imagesBase64.length === 0) {
    return { success: false, message: "Thiếu dữ liệu bắt buộc (Tên hoặc Hình ảnh)." };
  }

  let finalImageUrls: string[] = [];
  let uploadErrors: string[] = [];

  for (let i = 0; i < imagesBase64.length; i++) {
    const base64 = imagesBase64[i];
    try {
      if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        const result = await cloudinary.uploader.upload(base64, {
          folder: "chatbot-products",
          public_id: `${name.replace(/\\s+/g, "-").toLowerCase()}-${i}-${Date.now()}`,
        });
        finalImageUrls.push(result.secure_url);
      } else {
        uploadErrors.push(`(Hình ${i + 1}) Thiếu Cloudinary Config.`);
      }
    } catch (err: any) {
      console.error(`[Upload Error] Ảnh ${i}:`, err);
      uploadErrors.push(`(Hình ${i + 1}) ${err.message || "Lỗi Cloudinary"}`);
    }
  }

  if (finalImageUrls.length === 0) {
    return {
      success: false,
      message: "Tất cả file ảnh đều không thể tải lên kho lưu trữ. " + uploadErrors.join(", "),
    };
  }

  try {
    const product = await upsertProduct({
      id: crypto.randomUUID(),
      name,
      note: note,
      imageUrl: finalImageUrls.join(", "),
      ownerId: session.user.id,
      category,
      sku,
    });
    console.log("[handleInteractiveProductUpload] Success", product);
    return { success: true, product };
  } catch (error: any) {
    console.error("[handleInteractiveProductUpload] DB Error", error);
    return { success: false, message: "Lỗi lưu Database: " + error.message };
  }
}
