import {
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  CloudUpload,
  Download,
  FilePlus,
  Folder,
  Globe,
  LayoutGrid,
  Minus,
  Music,
  Play,
  RotateCcw,
  Shrink,
  Square,
  SquareStack,
  Video,
  X,
} from "lucide";

// Lucide is the icon set used by 21st.dev / shadcn components.
const LUCIDE = {
  convert: ArrowRightLeft,
  compress: Shrink,
  download: Download,
  tools: LayoutGrid,
  upload: CloudUpload,
  browse: FilePlus,
  folder: Folder,
  help: CircleQuestionMark,
  check: Check,
  close: X,
  play: Play,
  prev: ChevronLeft,
  next: ChevronRight,
  video: Video,
  music: Music,
  globe: Globe,
  refresh: RotateCcw,
  minimize: Minus,
  maximize: Square,
  restore: SquareStack,
} satisfies Record<string, typeof Check>;

// Brand marks are not part of Lucide.
const BRANDS = {
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  tiktok:
    "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.77 1.52V6.94a4.85 4.85 0 0 1-1.01-.25z",
} as const;

export type IconName = keyof typeof LUCIDE | keyof typeof BRANDS;

export interface IconOptions {
  size?: number;
  stroke?: number;
  class?: string;
  /** Fill the shape with currentColor (e.g. the play glyph). */
  filled?: boolean;
}

const isBrand = (name: IconName): name is keyof typeof BRANDS => name in BRANDS;

export function icon(
  name: IconName,
  { size = 16, stroke = 2.5, class: className, filled = false }: IconOptions = {},
): string {
  const cls = className ? `icon ${className}` : "icon";
  const common = `class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"`;

  if (isBrand(name)) {
    return `<svg ${common} fill="currentColor"><path d="${BRANDS[name]}"/></svg>`;
  }

  const shapes = LUCIDE[name]
    .map(([tag, attrs]) => {
      const props = Object.entries(attrs)
        .filter(([key]) => key !== "key")
        .map(([key, value]) => ` ${key}="${value}"`)
        .join("");
      return `<${tag}${props}/>`;
    })
    .join("");

  return `<svg ${common} fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}
