"use client";

import { useEffect, useRef, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { launchpadFactoryAbi } from "@/lib/abis";
import { LAUNCHPAD_FACTORY } from "@/lib/config";
import { uploadTokenImage, validateImageFile } from "@/lib/upload";

export function CreateTokenModal({ onClose }: { onClose: () => void }) {
  const { isConnected } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    image: "",
    twitter: "",
    telegram: "",
    website: "",
    devBuy: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function clearImage() {
    setImageFile(null);
    setForm((f) => ({ ...f, image: "" }));
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onImageSelected(file: File | null) {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploadError(null);
    setImageFile(file);
    setForm((f) => ({ ...f, image: "" }));
  }

  async function submit() {
    let imageUrl = form.image;
    if (imageFile) {
      setUploading(true);
      setUploadError(null);
      try {
        imageUrl = await uploadTokenImage(imageFile);
        setForm((f) => ({ ...f, image: imageUrl }));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    writeContract({
      address: LAUNCHPAD_FACTORY,
      abi: launchpadFactoryAbi,
      functionName: "createToken",
      args: [
        form.name,
        form.symbol,
        form.description,
        imageUrl,
        form.twitter,
        form.telegram,
        form.website,
      ],
      value: form.devBuy ? parseEther(form.devBuy) : 0n,
    });
  }

  const busy = uploading || isPending || mining;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Launch a new token</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
        </div>

        {isSuccess ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-semibold">Token launched!</p>
            <button className="btn-green mt-4" onClick={onClose}>Back to board</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              <input className="input" placeholder="Ticker (e.g. DOGE)" value={form.symbol} onChange={(e) => set("symbol", e.target.value)} />
            </div>
            <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />

            <div>
              <label className="text-sm text-white/60">Token image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => onImageSelected(e.target.files?.[0] ?? null)}
              />
              {imagePreview ? (
                <div className="mt-1 flex items-center gap-3 p-3 bg-pump-bg border border-pump-border rounded-lg">
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{imageFile?.name}</p>
                    <p className="text-xs text-white/50">
                      {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-white/50 hover:text-white shrink-0"
                    onClick={clearImage}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-1 w-full border border-dashed border-pump-border rounded-lg px-3 py-8 text-center hover:border-pump-accent transition-colors disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <div className="text-2xl mb-1">📷</div>
                  <p className="text-sm font-medium">Click to upload an image</p>
                  <p className="text-xs text-white/50 mt-1">PNG, JPG, GIF, or WebP · max 5 MB</p>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Twitter" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
              <input className="input" placeholder="Telegram" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} />
              <input className="input" placeholder="Website" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-white/60">Optional dev buy (ETH)</label>
              <input className="input mt-1" placeholder="0.0" value={form.devBuy} onChange={(e) => set("devBuy", e.target.value)} />
            </div>

            {uploadError && <p className="text-pump-red text-sm break-words">{uploadError}</p>}
            {error && <p className="text-pump-red text-sm break-words">{error.message}</p>}

            <button
              className="btn-green w-full"
              disabled={!isConnected || !form.name || !form.symbol || busy}
              onClick={submit}
            >
              {!isConnected
                ? "Connect wallet first"
                : uploading
                  ? "Uploading image…"
                  : isPending || mining
                    ? "Launching…"
                    : "Launch token"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
