"use client";

import { useCallback, useState, useTransition } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useRouter } from "next/navigation";
import { updateChildAvatar } from "@/lib/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  childId: string;
  childName: string;
  imageUrl: string; // object URL for the picked file
}

async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  // Output a 512x512 square PNG (plenty for a circular avatar, small enough to keep upload fast)
  const outputSize = 512;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d ctx unavailable");

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob fail"))), "image/png")
  );
}

export function AvatarEditorModal({ open, onClose, childId, childName, imageUrl }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  function handleSave() {
    if (!croppedArea) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await getCroppedImage(imageUrl, croppedArea);
        const formData = new FormData();
        formData.append("file", new File([blob], `${childId}.png`, { type: "image/png" }));
        const result = await updateChildAvatar(childId, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
        onClose();
      } catch (err) {
        setError((err as Error).message ?? "Crop failed");
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-5">
        <h2 className="font-display font-extrabold text-xl text-ink mb-1">{childName}&apos;s photo</h2>
        <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-3">
          Drag to reposition · Pinch or use slider to zoom
        </p>

        <div className="relative w-full h-64 bg-ink/10 rounded-lg overflow-hidden">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1"
          />
        </div>

        {error && <p className="text-sm text-[#ef8c8f] mt-3">{error}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !croppedArea}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
