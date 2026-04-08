"use client";

import { CheckCircle2, ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  fetchMyProducts,
  getProductDetailsAction,
  handleInteractiveProductUpload,
} from "@/app/(chat)/actions";

export function ProductUploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [myProducts, setMyProducts] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for form fields to allow programmatic updates
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Fetch user products on mount for datalist
  useEffect(() => {
    const loadProducts = async () => {
      const logs = await fetchMyProducts();
      setMyProducts(logs);
    };
    loadProducts();
  }, []);

  const handleNameChange = async (name: string) => {
    setProductName(name);
    if (!name.trim()) {
      setExistingImages([]);
      return;
    }

    // Try to fetch details if name exists in myProducts
    const details = await getProductDetailsAction(name);
    if (details) {
      setSku(details.sku || "");
      setCategory(details.category || "");
      setExistingImages(details.images || []);
    } else {
      setExistingImages([]);
    }
  };

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

    if (!productName.trim()) {
      setErrorMsg("Vui lòng nhập tên sản phẩm.");
      return;
    }

    setIsUploading(true);
    try {
      const base64Images = await Promise.all(
        files.map((f) => encodeFileToBase64(f)),
      );

      const formData = new FormData();
      formData.append("name", productName);
      formData.append("sku", sku);
      formData.append("category", category);
      formData.append("note", note);

      for (const b64 of base64Images) {
        formData.append("imagesBase64", b64);
      }

      const result = await handleInteractiveProductUpload(formData);
      if (result.success) {
        setSuccess(true);
        setFiles([]);
        setPreviews([]);

        // Ensuring we show the NEW consolidated list of images (old + new)
        const updatedProduct = Array.isArray(result.product)
          ? result.product[0]
          : result.product;
        if (updatedProduct?.imageUrls) {
          const allImgs = updatedProduct.imageUrls
            .split(",")
            .map((i: string) => i.trim())
            .filter(Boolean);
          setExistingImages(allImgs);
        }

        // Refresh products list for autocomplete
        const updated = await fetchMyProducts();
        setMyProducts(updated);
      } else {
        setErrorMsg(result.message || "Lỗi khi lưu sản phẩm.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
      setErrorMsg(message);
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg max-w-[500px] w-full my-4">
        <div className="flex flex-col items-center text-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold">Tải lên thành công!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Đã trích xuất và lưu {existingImages.length} ảnh vào hệ thống.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
            Danh sách Link ảnh vừa trích xuất:
          </p>
          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 border rounded-md p-2 bg-muted/30">
            {existingImages.map((url, idx) => (
              <div key={url} className="flex items-center gap-2 group">
                <div className="text-[10px] bg-secondary px-1.5 py-0.5 rounded shrink-0 font-mono">
                  #{idx + 1}
                </div>
                <input
                  readOnly
                  value={url}
                  className="text-[11px] bg-transparent border-none focus:ring-0 truncate flex-1 font-mono text-blue-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    alert("Đã copy link thành công!");
                  }}
                  className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setProductName("");
            setSku("");
            setCategory("");
            setNote("");
            setExistingImages([]);
            setIsAddingNew(false);
          }}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-all shadow-md"
        >
          Tiếp tục tải sản phẩm khác
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

      <section
        aria-label="Drop zone for uploading images"
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
      </section>

      {/* NEW: Previews for selected new files */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ảnh chuẩn bị tải lên
          </p>
          <div className="flex flex-wrap gap-2">
            {previews.map((preview, idx) => (
              <div
                key={`new-${preview}`}
                className="relative group rounded-md border overflow-hidden h-16 w-16 flex-shrink-0 bg-muted"
              >
                <Image
                  src={preview}
                  alt={`New preview ${idx + 1}`}
                  className="object-cover"
                  fill
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  disabled={isUploading}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW: Aggregated Existing Images */}
      {existingImages.length > 0 && (
        <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-secondary">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              Hình ảnh hiện có trên kho
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((url) => (
              <div
                key={url}
                className="flex flex-col items-center gap-1.5 w-16 mb-2"
              >
                <div
                  className="relative rounded-md border border-border/50 overflow-hidden h-14 w-14 shrink-0 bg-background shadow-sm hover:scale-105 transition-transform"
                  title={url}
                >
                  <Image
                    src={url}
                    alt="Sản phẩm hiện có"
                    className="object-cover"
                    fill
                    unoptimized
                  />
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-blue-600 hover:text-blue-800 underline truncate w-full text-center px-0.5"
                  title={url}
                >
                  Xem link
                </a>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * Các ảnh bạn tải lên thêm sẽ được gộp vào danh sách này.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              Tên sản phẩm *
            </label>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(!isAddingNew);
                if (!isAddingNew) setProductName("");
              }}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              {isAddingNew ? "← Chọn từ danh sách" : "+ Nhập sản phẩm mới"}
            </button>
          </div>

          {isAddingNew ? (
            <input
              autoComplete="off"
              id="name"
              name="name"
              value={productName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nhập tên sản phẩm mới..."
              disabled={isUploading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <select
              id="name"
              name="name"
              value={productName}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isUploading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">-- Chọn sản phẩm có sẵn --</option>
              {myProducts.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {myProducts.length === 0 && !isAddingNew && (
            <p className="text-[10px] text-muted-foreground italic">
              * Bạn chưa có sản phẩm nào. Hãy nhấn "Nhập sản phẩm mới".
            </p>
          )}
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
              value={sku}
              onChange={(e) => setSku(e.target.value)}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
