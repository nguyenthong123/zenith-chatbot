"use client";

import { CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { handleInteractiveProductUpload } from "@/app/(chat)/actions";

export function ProductUploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validImageFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (validImageFiles.length === 0) return;

    setFiles((prev) => [...prev, ...validImageFiles]);
    const newPreviews = validImageFiles.map((file) =>
      URL.createObjectURL(file),
    );
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const newPrev = [...prev];
      URL.revokeObjectURL(newPrev[index]);
      newPrev.splice(index, 1);
      return newPrev;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const encodeFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    if (files.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 ảnh để tải lên.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    if (!name.trim()) {
      setErrorMsg("Vui lòng nhập tên sản phẩm.");
      return;
    }

    setIsUploading(true);
    try {
      // Due to Vercel Server Actions occasionally struggling with raw File objects inside FormData over certain limits,
      // we'll convert images to base64 and append them.
      const base64Images = await Promise.all(
        files.map((f) => encodeFileToBase64(f)),
      );
      base64Images.forEach((b64) => formData.append("imagesBase64", b64));

      const result = await handleInteractiveProductUpload(formData);
      if (result.success) {
        setSuccess(true);
        setFiles([]);
        setPreviews([]);
      } else {
        setErrorMsg(result.message || "Lỗi khi lưu sản phẩm.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-sm max-w-md w-full my-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
        <h3 className="text-lg font-semibold">Tải lên thành công!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Sản phẩm đã được lưu an toàn vào cơ sở dữ liệu và Cloudinary.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80"
        >
          Tải thêm ảnh khác
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm max-w-[500px] w-full my-4 flex flex-col gap-5"
    >
      <div>
        <h3 className="text-base font-semibold leading-none mb-1">
          Thêm sản phẩm mới
        </h3>
        <p className="text-sm text-muted-foreground">
          Tải ảnh trực tiếp lên kho và tự động trích xuất link.
        </p>
      </div>

      <div
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Kéo thả ảnh vào đây</p>
        <p className="text-xs text-muted-foreground mb-4">
          hoặc nhấn để duyệt file (JPG, PNG)
        </p>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow hover:bg-secondary/80"
        >
          Chọn ảnh từ máy
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*"
          className="hidden"
        />
      </div>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {previews.map((preview, idx) => (
            <div
              key={idx}
              className="relative group rounded-md border overflow-hidden h-20 w-20 flex-shrink-0 bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="preview"
                className="object-cover w-full h-full"
              />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                disabled={isUploading}
                className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Tên sản phẩm *
          </label>
          <input
            autoComplete="off"
            id="name"
            name="name"
            placeholder="vd: Tấm vân gỗ 18mm"
            disabled={isUploading}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="sku"
              className="text-sm font-medium text-foreground"
            >
              Mã (SKU)
            </label>
            <input
              autoComplete="off"
              id="sku"
              name="sku"
              placeholder="VD: M20"
              disabled={isUploading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="category"
              className="text-sm font-medium text-foreground"
            >
              Danh mục
            </label>
            <input
              autoComplete="off"
              id="category"
              name="category"
              placeholder="VD: Ván MDF"
              disabled={isUploading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="note" className="text-sm font-medium text-foreground">
            Ghi chú
          </label>
          <textarea
            id="note"
            name="note"
            placeholder="Mô tả thêm về sản phẩm..."
            disabled={isUploading}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm font-medium text-destructive">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={isUploading}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isUploading ? "Đang tiến hành lưu và upload..." : "Lưu sản phẩm"}
      </button>
    </form>
  );
}
