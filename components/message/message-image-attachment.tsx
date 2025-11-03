"use client";

import Image from "next/image";
import { useState } from "react";
import { CrossSmallIcon, FullscreenIcon } from "@/components/shared/icons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Attachment } from "@/lib/types";
import { convertToProxyUrl } from "@/lib/utils";

export default function MessageImageAttachment({
  attachment,
  className = "",
}: {
  attachment: Attachment;
  className?: string;
}) {
  const { name, url, contentType, file } = attachment;
  const [isOpen, setIsOpen] = useState(false);

  // Generate preview URL from File object for images, or convert R2 URL to proxy URL
  const imageSource =
    file && contentType?.startsWith("image")
      ? URL.createObjectURL(file)
      : convertToProxyUrl(url);

  // Check if the attachment is an image
  const isImage = contentType?.startsWith("image") && imageSource;

  // Use unoptimized for blob URLs and proxy URLs from our API
  const shouldUnoptimize = !!file || imageSource.includes("/api/files/get");

  if (!isImage) {
    return null;
  }

  return (
    <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
      <AlertDialogTrigger asChild>
        <div
          className={`group relative inline-block cursor-pointer ${className}`}
        >
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            <Image
              alt={name ?? "An image attachment"}
              className="max-h-64 max-w-xs object-cover transition-transform duration-200 group-hover:scale-105"
              height={256}
              src={imageSource}
              unoptimized={shouldUnoptimize}
              width={320}
            />

            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
              <FullscreenIcon size={20} />
            </div>
          </div>

          <div className="mt-1 max-w-xs truncate text-muted-foreground text-xs">
            {name}
          </div>
        </div>
      </AlertDialogTrigger>

      <AlertDialogContent className="h-[90vh] max-h-[90vh] w-full max-w-6xl overflow-hidden border-0 bg-black/95 p-0">
        <div className="relative flex h-full w-full items-center justify-center">
          <Button
            className="absolute top-4 right-4 z-10 rounded-full border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
            size="sm"
            variant="outline"
          >
            <CrossSmallIcon size={16} />
          </Button>

          <div className="relative flex h-full w-full items-center justify-center p-8">
            <Image
              alt={name ?? "Enlarged image attachment"}
              className="max-h-full max-w-full object-contain"
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
              src={imageSource}
              unoptimized={shouldUnoptimize}
            />
          </div>

          <div className="absolute right-4 bottom-4 left-4 text-center">
            <p className="inline-block truncate rounded bg-black/50 px-3 py-1 text-sm text-white/80">
              {name}
            </p>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
