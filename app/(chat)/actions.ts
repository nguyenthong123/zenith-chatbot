"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { titleModel } from "@/lib/ai/models";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import cloudinary from "@/lib/cloudinary";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  updateChatVisibilityById,
  upsertProduct,
} from "@/lib/db/queries";
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
    return {
      success: false,
      message: "Thiếu dữ liệu bắt buộc (Tên hoặc Hình ảnh).",
    };
  }

  // Ensure Cloudinary is configured with fresh, trimmed env vars
  cloudinary.config({
    cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
    api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
    api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim(),
    secure: true,
  });

  const finalImageUrls: string[] = [];
  const uploadErrors: string[] = [];

  for (let i = 0; i < imagesBase64.length; i++) {
    const base64 = imagesBase64[i];
    try {
      const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();

      if (
        (process.env.CLOUDINARY_API_KEY || "").trim() &&
        (process.env.CLOUDINARY_API_SECRET || "").trim()
      ) {
        const result = await cloudinary.uploader.upload(base64, {
          folder: "chatbot-products",
          public_id: `${slug}-${i}-${Date.now()}`,
        });
        finalImageUrls.push(result.secure_url);
      } else {
        uploadErrors.push(`(Hình ${i + 1}) Thiếu Cloudinary Config.`);
      }
    } catch (err: unknown) {
      console.error(`[Cloudinary Upload Error - Image ${i + 1}]:`, err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as any).message)
          : "Lỗi Cloudinary";
      uploadErrors.push(`(Hình ${i + 1}) ${message}`);
    }
  }

  console.log(
    `[Product Upload] User "${session.user.email}" (ID: ${session.user.id}) is uploading "${name}"`,
  );

  if (finalImageUrls.length === 0) {
    const errorPrefix = (process.env.CLOUDINARY_API_KEY || "").trim()
      ? ""
      : "[Thiếu API KEY] ";
    return {
      success: false,
      message: `${errorPrefix}Tất cả file ảnh đều không thể tải lên kho lưu trữ. ${uploadErrors.join(", ")}`,
    };
  }

  try {
    const productimageUrls = finalImageUrls.join(", ");
    console.log(
      `[Database Upsert] Saving product "${name}" with images:`,
      productimageUrls,
    );

    const product = await upsertProduct({
      id: crypto.randomUUID(),
      name,
      note: note,
      imageUrls: productimageUrls,
      ownerId: session.user.id!,
      category,
      sku,
    });
    return { success: true, product };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Lỗi lưu Database: ${message}` };
  }
}

export async function fetchMyProducts() {
  const session = await auth();
  if (!session?.user?.id) {
    console.log("[fetchMyProducts] No session found.");
    return [];
  }
  console.log(
    `[fetchMyProducts] Fetching products for user ID: ${session.user.id} (${session.user.email})`,
  );
  const { getProductsByUserId } = await import("@/lib/db/queries");
  const products = await getProductsByUserId({ userId: session.user.id });
  console.log(`[fetchMyProducts] Found ${products.length} products.`);
  return products;
}

export async function getProductDetailsAction(name: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { getProductsByNameAndUser } = await import("@/lib/db/queries");
  const products = await getProductsByNameAndUser({
    name,
    userId: session.user.id,
  });

  if (products.length === 0) return null;

  // Aggregate images
  const allImages = Array.from(
    new Set(
      products.flatMap((p) =>
        (p.imageUrls || "")
          .split(",")
          .map((i: any) => i.trim())
          .filter(Boolean),
      ),
    ),
  );

  return {
    sku: products[0].sku,
    category: products[0].category,
    images: allImages,
  };
}
