import { toBlob } from "html-to-image";

export function buildShareFilename(plannerName: string): string {
  const slug = plannerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${slug}-planner-${date}.png`;
}

export async function sharePlannerImage(opts: {
  element: HTMLElement;
  filename: string;
}): Promise<{ shared: boolean; error?: string }> {
  let blob: Blob | null;
  try {
    blob = await toBlob(opts.element, { cacheBust: true, pixelRatio: 2 });
  } catch (e: unknown) {
    return { shared: false, error: (e as Error).message };
  }
  if (!blob) return { shared: false, error: "Could not render image." };

  const file = new File([blob], opts.filename, { type: "image/png" });

  // Prefer the native share sheet when available (iOS Safari, Chrome on Android).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My planner" });
      return { shared: true };
    } catch {
      // Fall through to download on user cancel / unsupported.
    }
  }

  // Desktop / unsupported fallback: trigger a download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { shared: true };
}
