"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName?: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  // Take only the first 6 images for the grid
  const displayImages = images.slice(0, 6);

  return (
    <div className="group/gallery relative w-full space-y-3">
      {/* Main Display Grid */}
      <div
        className={cn(
          "grid gap-2 overflow-hidden rounded-2xl border border-border/50 bg-muted/30 p-1 backdrop-blur-sm shadow-sm transition-all duration-300 group-hover/gallery:border-border/80 group-hover/gallery:shadow-md",
          images.length === 1
            ? "grid-cols-1"
            : images.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {displayImages.map((url, idx) => (
          <button
            key={url}
            type="button"
            className={cn(
              "relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted transition-transform duration-500 hover:scale-[1.02] active:scale-95 border-0 p-0",
              images.length === 3 && idx === 0 && "sm:col-span-1 sm:row-span-1",
              images.length > 3 &&
                idx === 0 &&
                "sm:col-span-2 sm:row-span-2 aspect-auto sm:aspect-square",
            )}
            onClick={() => setSelectedImage(idx)}
          >
            <Image
              src={url}
              alt={productName || `Product image ${idx + 1}`}
              fill
              unoptimized
              className="object-cover transition-opacity duration-300"
              sizes="(max-width: 768px) 100vw, 33vw"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 hover:bg-black/20 hover:opacity-100">
              <div className="rounded-full bg-white/20 p-2 backdrop-blur-md ring-1 ring-white/30">
                <Expand className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Counter Badge if many images */}
            {images.length > 6 && idx === 5 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-medium backdrop-blur-[2px]">
                +{images.length - 6}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            type="button"
            className="absolute top-4 right-4 z-[60] rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setSelectedImage(null)}
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="absolute left-4 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={selectedImage === 0}
            onClick={() =>
              setSelectedImage((prev) =>
                prev !== null ? Math.max(0, prev - 1) : null,
              )
            }
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          <div className="relative h-[80vh] w-[90vw] max-w-4xl animate-in zoom-in-95 duration-300">
            <Image
              src={images[selectedImage]}
              alt="Fullscreen view"
              fill
              unoptimized
              className="object-contain"
              priority
            />
          </div>

          <button
            type="button"
            className="absolute right-4 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"
            disabled={selectedImage === images.length - 1}
            onClick={() =>
              setSelectedImage((prev) =>
                prev !== null ? Math.min(images.length - 1, prev + 1) : null,
              )
            }
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8" />
          </button>

          <div className="absolute bottom-8 text-white/70 text-sm font-medium">
            {selectedImage + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
