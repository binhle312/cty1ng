import { useMutation, useQuery } from "@tanstack/react-query";
import { type KeyboardEvent, type PointerEvent, type RefObject, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons } from "../../components/ui/dialog.tsx";
import { Slider } from "../../components/ui/slider.tsx";
import { apiErrorText } from "../../lib/api/api-error.ts";
import {
  getAvatarLimitsOptions,
  uploadAvatarMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { SaveButton } from "../skills/save-bar.tsx";

// The upload of an avatar image (bot-avatar.md §6 AV4, security.md §2.4): the file picker, the
// page's own type and size check (the limits come from `GET /avatars/limits`, so the words match
// the server), then the crop card: drag to move, a zoom slider, a round mask, Cancel and Use.
// Use sends the cropped square; the server re-encodes it and returns its id. The bot uses it
// only after Create or Save.
//
// The CSP blocks `blob:` images, so the file is read as a `data:` URL (M2 plan, P6).

// The side of the square the crop card sends; the server makes it 256 × 256.
const OUTPUT_PX = 256;
// The side of the round mask on the screen.
const VIEW_PX = 240;
const ZOOM_MAX = 3;

export interface UploadedAvatar {
  id: string;
  url: string;
}

function megabytes(bytes: number): string {
  return `${String(Number((bytes / 1_048_576).toFixed(1)))} MB`;
}

export function useAvatarUpload({
  onUploaded,
  onError,
}: {
  onUploaded: (avatar: UploadedAvatar) => void;
  onError: (message: string | null) => void;
}) {
  const limits = useQuery(getAvatarLimitsOptions());
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);

  const choose = () => {
    onError(null);
    input.current?.click();
  };

  const onFile = (file: File) => {
    const accepted = limits.data?.accepted_types ?? ["image/png", "image/jpeg", "image/webp"];
    if (!accepted.includes(file.type)) {
      onError("Use a PNG, JPEG or WebP image.");
      return;
    }
    const max = limits.data?.max_bytes;
    if (max !== undefined && file.size > max) {
      onError(`The image is ${megabytes(file.size)}. The limit is ${megabytes(max)}.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSource(reader.result);
    };
    reader.onerror = () => {
      onError("The app could not read the image. Try another file.");
    };
    reader.readAsDataURL(file);
  };

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      aria-label="Upload image"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file !== undefined) onFile(file);
      }}
    />
  );
  const card = (
    <CropCard
      source={source}
      onCancel={() => {
        setSource(null);
      }}
      onUploaded={(avatar) => {
        setSource(null);
        onUploaded(avatar);
      }}
      onError={(message) => {
        setSource(null);
        onError(message);
      }}
    />
  );
  return { choose, picker, card };
}

function CropCard({
  source,
  onCancel,
  onUploaded,
  onError,
}: {
  source: string | null;
  onCancel: () => void;
  onUploaded: (avatar: UploadedAvatar) => void;
  onError: (message: string) => void;
}) {
  const use = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={source !== null} onClose={onCancel} title="Crop the image" defaultButton={use}>
      {source !== null && (
        <Cropper
          key={source}
          source={source}
          useButton={use}
          onCancel={onCancel}
          onUploaded={onUploaded}
          onError={onError}
        />
      )}
    </Dialog>
  );
}

function Cropper({
  source,
  useButton,
  onCancel,
  onUploaded,
  onError,
}: {
  source: string;
  useButton: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onUploaded: (avatar: UploadedAvatar) => void;
  onError: (message: string) => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  // The image's top-left corner inside the mask, in screen pixels.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const { mutateAsync, isPending } = useMutation(uploadAvatarMutation());

  const base = natural === null ? 1 : Math.max(VIEW_PX / natural.w, VIEW_PX / natural.h);
  const scale = base * zoom;
  const shown =
    natural === null ? { w: VIEW_PX, h: VIEW_PX } : { w: natural.w * scale, h: natural.h * scale };
  // The image always covers the mask.
  const clamp = (x: number, y: number, size = shown) => ({
    x: Math.min(0, Math.max(VIEW_PX - size.w, x)),
    y: Math.min(0, Math.max(VIEW_PX - size.h, y)),
  });

  const zoomTo = (next: number) => {
    if (natural === null) return;
    const nextScale = base * next;
    const size = { w: natural.w * nextScale, h: natural.h * nextScale };
    // Zoom around the centre of the mask.
    const cx = (VIEW_PX / 2 - offset.x) / scale;
    const cy = (VIEW_PX / 2 - offset.y) / scale;
    setOffset(clamp(VIEW_PX / 2 - cx * nextScale, VIEW_PX / 2 - cy * nextScale, size));
    setZoom(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 10;
    const moves: Partial<Record<string, { x: number; y: number }>> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setOffset(clamp(offset.x + move.x, offset.y + move.y));
  };

  const crop = () => {
    const img = image.current;
    if (img === null || natural === null) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const context = canvas.getContext("2d");
    if (context === null) {
      onError("The app could not crop the image. Try another file.");
      return;
    }
    const side = VIEW_PX / scale;
    context.drawImage(
      img,
      -offset.x / scale,
      -offset.y / scale,
      side,
      side,
      0,
      0,
      OUTPUT_PX,
      OUTPUT_PX,
    );
    canvas.toBlob((blob) => {
      if (blob === null) {
        onError("The app could not crop the image. Try another file.");
        return;
      }
      const file = new File([blob], "avatar.png", { type: "image/png" });
      mutateAsync({ body: { file } })
        .then((uploaded) => {
          onUploaded({ id: uploaded.avatar_id, url: uploaded.url });
        })
        .catch((error: unknown) => {
          onError(apiErrorText(error));
        });
    }, "image/png");
  };

  return (
    <>
      <p className="mt-2 text-on-surface-muted">Drag the image to move it. Zoom with the slider.</p>
      <div className="mt-4 flex justify-center">
        <div
          role="group"
          tabIndex={0}
          aria-label="Image position. Arrow keys move it."
          onKeyDown={onKeyDown}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
          }}
          onPointerMove={(event) => {
            if (drag.current === null) return;
            setOffset(clamp(event.clientX - drag.current.x, event.clientY - drag.current.y));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          className="relative size-60 cursor-move touch-none overflow-hidden rounded-card bg-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <img
            ref={image}
            src={source}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
              const fit = Math.max(VIEW_PX / w, VIEW_PX / h);
              setNatural({ w, h });
              setOffset({ x: (VIEW_PX - w * fit) / 2, y: (VIEW_PX - h * fit) / 2 });
            }}
            className="absolute top-0 left-0 max-w-none select-none"
            style={{
              width: `${String(shown.w)}px`,
              height: `${String(shown.h)}px`,
              transform: `translate(${String(offset.x)}px, ${String(offset.y)}px)`,
            }}
          />
          {/* The round mask: everything outside the circle is dimmed. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-pill crop-mask"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-on-surface-muted">Zoom</span>
        <Slider
          label="Zoom"
          value={zoom}
          min={1}
          max={ZOOM_MAX}
          step={0.05}
          valueText={(z) => `${String(Math.round(z * 100))} %`}
          onChange={zoomTo}
        />
      </div>
      <DialogButtons>
        <Button onClick={onCancel}>Cancel</Button>
        <SaveButton
          ref={useButton}
          label="Use"
          disabledReason={
            natural === null ? "The image is loading." : isPending ? "Uploading the image." : null
          }
          onClick={crop}
        />
      </DialogButtons>
    </>
  );
}
