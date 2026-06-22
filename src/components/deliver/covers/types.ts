import type { PhotoPaths } from '@/lib/photoUrl';
import type { TitleCaseMode } from '@/types/gallery';
import type { ComponentType, LazyExoticComponent } from 'react';

export interface CoverVariantProps {
  coverPhoto: PhotoPaths | null;
  sessionName: string;
  studioName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  isDark?: boolean;
  primaryColor?: string;
  onEnter: () => void;
}

export interface CoverVariant {
  id: string;
  name: string;
  description: string;
  Component: LazyExoticComponent<ComponentType<CoverVariantProps>>;
  Thumbnail: ComponentType<{ className?: string }>;
}
