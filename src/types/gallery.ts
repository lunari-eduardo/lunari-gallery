export type GalleryStatus = 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled';
export type SelectionStatus = 'in_progress' | 'confirmed' | 'blocked';
export type WatermarkType = 'none' | 'text' | 'logo';
export type PreviewResolution = 'low' | 'medium' | 'high';
export type DownloadOption = 'disabled' | 'allowed' | 'after_selection';
export type DeadlinePreset = 7 | 10 | 15 | 'custom';

export interface WatermarkSettings {
  type: WatermarkType;
  text?: string;
  logoUrl?: string;
  opacity: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export interface GallerySettings {
  welcomeMessage: string;
  deadline: Date;
  deadlinePreset: DeadlinePreset;
  watermark: WatermarkSettings;
  previewResolution: PreviewResolution;
  allowComments: boolean;
  downloadOption: DownloadOption;
  allowExtraPhotos: boolean;
}

export interface GalleryPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  isSelected: boolean;
  comment?: string;
  order: number;
}

export interface GalleryAction {
  id: string;
  type: 'created' | 'sent' | 'client_started' | 'client_confirmed' | 'selection_reopened' | 'expired';
  timestamp: Date;
  description: string;
}

export interface Gallery {
  id: string;
  clientName: string;
  clientEmail: string;
  sessionName: string;
  packageName: string;
  includedPhotos: number;
  extraPhotoPrice: number;
  status: GalleryStatus;
  selectionStatus: SelectionStatus;
  settings: GallerySettings;
  photos: GalleryPhoto[];
  actions: GalleryAction[];
  createdAt: Date;
  updatedAt: Date;
  selectedCount: number;
  extraCount: number;
  extraTotal: number;
}

export interface GlobalSettings {
  publicGalleryEnabled: boolean;
  clientTheme: 'light' | 'dark' | 'system';
  language: string;
  defaultExpirationDays: number;
  studioName: string;
  studioLogo?: string;
}

export interface ExportData {
  filename: string;
  selected: boolean;
}

export type ClientStatus = 'active' | 'no_gallery';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  galleryPassword: string;
  status: ClientStatus;
  linkedGalleries: string[];
  createdAt: Date;
  updatedAt: Date;
}
