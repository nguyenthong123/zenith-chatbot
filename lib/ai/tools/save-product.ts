import { tool } from "ai";
import axios from "axios";
import { z } from "zod";
import cloudinary from "@/lib/cloudinary";
import { upsertProduct } from "@/lib/db/queries";
import { uploadToImgBB } from "@/lib/imgbb";
import { generateUUID } from "@/lib/utils";

export const getSaveProductTool = (userId: string, userEmail?: string) =>
  tool({
    description:
      "Save a product with its name, description, and multiple images to the database and Cloudinary. This tool behaves like GitHub assets: it will update existing products if the name matches and append new image links.",
    inputSchema: z.object({
      name: z.string().describe("The name of the product."),
      description: z
        .string()
        .describe(
          "A short introduction or description of the product (saved as 'note').",
        ),
      imageUrls: z
        .array(z.string())
        .describe(
          "An array of ALL URLs of the images to save. Collect every URL from all 'Attachment URLs (for tool use)' blocks in the conversation history.",
        ),
      category: z
        .string()
        .optional()
        .describe("Optional category for the product."),
      sku: z.string().optional().describe("Optional SKU for the product."),
    }),
    execute: async ({ name, description, imageUrls, category, sku }) => {
      try {
        if (!imageUrls || imageUrls.length === 0) {
          return { error: "No image URLs provided." };
        }

        const finalImageUrls: string[] = [];

        const storageConfigured =
          !!(
            process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
          ) ||
          !!process.env.BLOB_READ_WRITE_TOKEN ||
          !!process.env.IMGBB_API_KEY;

        for (const [index, url] of imageUrls.entries()) {
          try {
            let base64: string | null = null;
            let contentType = "image/png";

            if (url.startsWith("data:")) {
              base64 = url;
            } else {
              const downloadRes = await axios.get(url, {
                responseType: "arraybuffer",
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                  Accept:
                    "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                  Referer: "https://github.com/",
                  "Cache-Control": "no-cache",
                  Pragma: "no-cache",
                },
                timeout: 10000,
              });

              contentType = downloadRes.headers["content-type"] || "image/png";
              const buffer = Buffer.from(downloadRes.data);
              base64 = `data:${contentType};base64,${buffer.toString("base64")}`;
            }

            if (base64) {
              let savedUrl: string | null = null;

              // 1. Try Cloudinary
              if (
                process.env.CLOUDINARY_API_KEY &&
                process.env.CLOUDINARY_API_SECRET
              ) {
                try {
                  const result = await cloudinary.uploader.upload(base64, {
                    folder: "chatbot-products",
                    public_id: `${name.replace(/\s+/g, "-").toLowerCase()}-${index}-${Date.now()}`,
                  });
                  savedUrl = result.secure_url;
                } catch (_err) {}
              }

              // 2. Try Vercel Blob if Cloudinary failed
              if (!savedUrl && process.env.BLOB_READ_WRITE_TOKEN) {
                try {
                  const { put } = await import("@vercel/blob");
                  const blob = await put(
                    `products/${name}-${index}.png`,
                    Buffer.from(base64.split(",")[1], "base64"),
                    {
                      access: "public",
                      contentType: "image/png",
                    },
                  );
                  savedUrl = blob.url;
                } catch (_err) {}
              }

              // 3. Try ImgBB if others failed
              if (!savedUrl && process.env.IMGBB_API_KEY) {
                try {
                  savedUrl = await uploadToImgBB(
                    base64,
                    process.env.IMGBB_API_KEY,
                  );
                } catch (_err) {}
              }

              // 4. Final Fallback: Direct Save for small data URLs or use original public URL
              if (savedUrl) {
                finalImageUrls.push(savedUrl);
              } else {
                if (url.startsWith("data:")) {
                  // If it's a data URL and we can't upload it, only save it directly if it's small enough (< 15MB)
                  // Base64 is ~1.33x binary size. 15MB * 1.33 = ~20,000,000 chars.
                  if (url.length < 20000000) {
                    finalImageUrls.push(url);
                  } else {
                  }
                } else {
                  // If it's a public URL (not data:), we can just save the URL itself as a fallback
                  finalImageUrls.push(url);
                }
              }
            }
          } catch (_error) {
            // Always push the original URL as a last resort if it's not a massive data URL
            if (!url.startsWith("data:") || url.length < 20000000) {
              finalImageUrls.push(url);
            }
          }
        }

        if (finalImageUrls.length === 0) {
          const configMsg = storageConfigured
            ? ""
            : " (Cấu hình Storage: Cloudinary/Vercel Blob chưa được thiết lập)";
          const diagnostics = imageUrls
            .map(
              (url, i) =>
                `[${i}]: len=${url.length}, start="${url.substring(0, 100)}"`,
            )
            .join(" | ");
          return {
            error: "Failed to save images.",
            message: `Không thể lưu được ảnh nào cho sản phẩm. (Chẩn đoán: ${diagnostics}). Vui lòng thử lại với ảnh nhỏ hơn hoặc cấu hình dịch vụ lưu trữ.${configMsg}`,
          };
        }
        const combinedUrl = finalImageUrls.join(", ");
        const _imageUrlsArray = finalImageUrls; // Still used for logging or future expansion
        const _upsertResult = await upsertProduct({
          id: generateUUID(),
          name: name.trim(),
          sku,
          note: description,
          imageUrls: combinedUrl,
          category: category || "General",
          ownerId: userId,
          ownerEmail: userEmail,
        });

        // Check if any URLs failed to upload and fell back to their original URL.
        // We know it failed if the final URL is identical to the input URL and it's not a data URL
        // (because successful Cloudinary/Vercel blob uploads return their own urls).
        const hasFailedUploads = finalImageUrls.some(
          (u, i) => u === imageUrls[i] && !u.startsWith("data:"),
        );

        const successMsg = hasFailedUploads
          ? `Sản phẩm "${name.trim()}" đã được lưu, NHƯNG ảnh đính kèm có chứa link không thể truy cập được (có thể là ảnh private hoặc bị lỗi 404). Hệ thống không thể tải và lưu ảnh này. Vui lòng tải ảnh thật lên từ máy tính hoặc cung cấp HTTP link công khai.`
          : `Sản phẩm "${name.trim()}" đã được lưu/cập nhật thành công với ${finalImageUrls.length} ảnh.`;

        return {
          success: true,
          message: successMsg,
          imageCount: finalImageUrls.length,
          hasFailedImageUploads: hasFailedUploads,
        };
      } catch (error) {
        return {
          error: "Failed to save product.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
