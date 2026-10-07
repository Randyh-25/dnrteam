import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
  ThreadsIcon,
  TikTokIcon,
  type BrandIconProps,
} from "@/components/dashboard/brand-icons";
import type { PlatformKey } from "@/lib/types";
import type { ComponentType } from "react";

export interface PlatformMeta {
  key: PlatformKey;
  label: string;
  icon: ComponentType<BrandIconProps>;
  color: string;
}

/** Shared display metadata for every platform (icon, label, brand colour). */
export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  youtube: { key: "youtube", label: "YouTube", icon: YoutubeIcon, color: "#FF0000" },
  instagram: { key: "instagram", label: "Instagram", icon: InstagramIcon, color: "#E4405F" },
  facebook: { key: "facebook", label: "Facebook", icon: FacebookIcon, color: "#1877F2" },
  threads: { key: "threads", label: "Threads", icon: ThreadsIcon, color: "#999999" },
  tiktok: { key: "tiktok", label: "TikTok", icon: TikTokIcon, color: "#00F2EA" },
};

export const PLATFORM_ORDER: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

export const PLATFORM_META_LIST = PLATFORM_ORDER.map((key) => PLATFORM_META[key]);
