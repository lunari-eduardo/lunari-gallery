import { GalleryTheme } from "./types";

export const THEME_REGISTRY: Record<string, GalleryTheme> = {
  lunari: {
    id: "lunari",
    name: "Lunari",
    description: "Equilíbrio perfeito entre elegância editorial e performance.",
    layout: {
      engine: "editorial-grid",
      columns: { mobile: 2, tablet: 3, desktop: 4 },
      defaultDensity: "comfortable",
      baseGap: 8,
    },
    typography: {
      titleFont: "serif",
      bodyFont: "sans-serif",
      caseMode: "normal",
    },
    surface: {
      background: "#ffffff",
      headerStyle: "glass",
      buttonStyle: "solid",
      borderRadius: "0px",
    },
  },
  clean: {
    id: "clean",
    name: "Clean",
    description: "Foco total na imagem com design minimalista e moderno.",
    layout: {
      engine: "masonry",
      columns: { mobile: 2, tablet: 3, desktop: 5 },
      defaultDensity: "compact",
      baseGap: 4,
    },
    typography: {
      titleFont: "sans-serif",
      bodyFont: "sans-serif",
      caseMode: "uppercase",
    },
    surface: {
      background: "#f8f8f8",
      headerStyle: "solid",
      buttonStyle: "outline",
      borderRadius: "4px",
    },
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Narrativa visual asssimétrica inspirada em revistas de luxo.",
    layout: {
      engine: "editorial-grid",
      columns: { mobile: 1, tablet: 2, desktop: 3 },
      defaultDensity: "airy",
      baseGap: 24,
    },
    typography: {
      titleFont: "serif",
      bodyFont: "serif",
      caseMode: "capitalize",
    },
    surface: {
      background: "#ffffff",
      headerStyle: "transparent",
      buttonStyle: "ghost",
      borderRadius: "0px",
    },
  },
  fineart: {
    id: "fineart",
    name: "Fine Art",
    description: "Exposição de arte com grandes respiros e foco em detalhes.",
    layout: {
      engine: "editorial-grid",
      columns: { mobile: 1, tablet: 1, desktop: 2 },
      defaultDensity: "airy",
      baseGap: 40,
    },
    typography: {
      titleFont: "serif",
      bodyFont: "sans-serif",
      caseMode: "normal",
    },
    surface: {
      background: "#1a1a1a",
      headerStyle: "glass",
      buttonStyle: "outline",
      borderRadius: "0px",
    },
  },
};

export const DEFAULT_THEME_ID = "lunari";
