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
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
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
