export type GalleryStatus = 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled';
export type SelectionStatus = 'in_progress' | 'confirmed' | 'blocked';
export type WatermarkType = 'none' | 'standard';
export type DeadlinePreset = 7 | 10 | 15 | 'custom';
export type ImageResizeOption = 640 | 800 | 1024 | 1920;
export type WatermarkDisplay = 'all' | 'fullscreen' | 'none';
export type GalleryPermission = 'public' | 'private';

// Tipos para configuração de venda
export type SaleMode = 'no_sale' | 'sale_with_payment' | 'sale_without_payment';
export type PricingModel = 'fixed' | 'packages';
export type ChargeType = 'all_selected' | 'only_extras';

export interface DiscountPackage {
  id: string;
  minPhotos: number;
  maxPhotos: number | null; // null = infinito (∞)
  pricePerPhoto: number;
}

// Predefinição de faixas de desconto salva
export interface DiscountPreset {
  id: string;
  name: string;
  packages: DiscountPackage[];
  createdAt: Date;
}

export interface SaleSettings {
  mode: SaleMode;
  pricingModel: PricingModel;
  chargeType: ChargeType;
  fixedPrice: number;
  discountPackages: DiscountPackage[];
}

export interface WatermarkSettings {
  type: WatermarkType;
  opacity: number;
  position: 'center'; // Standard watermark always uses center
}

export interface GallerySettings {
  welcomeMessage: string;
  deadline: Date;
  deadlinePreset: DeadlinePreset;
  watermark: WatermarkSettings;
  watermarkDisplay: WatermarkDisplay;
  imageResizeOption: ImageResizeOption;
  allowComments: boolean;
  allowDownload: boolean;
  allowExtraPhotos: boolean;
}

export interface GalleryPhoto {
  id: string;
  filename: string;           // UUID técnico para storage
  originalFilename: string;   // Nome original do arquivo (DSC_0001.jpg)
  displayName?: string;       // Nome de exibição customizado (opcional)
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
  saleSettings: SaleSettings;
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

// Tema personalizado para galerias do cliente
export interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  isDefault?: boolean;
}

// Template de email
export interface EmailTemplate {
  id: string;
  name: string;
  type: 'gallery_sent' | 'selection_reminder' | 'selection_confirmed';
  subject: string;
  body: string;
}

export interface GlobalSettings {
  // Configurações gerais
  defaultGalleryPermission: GalleryPermission;
  clientTheme: 'light' | 'dark' | 'system';
  defaultExpirationDays: number;
  studioName: string;
  studioLogo?: string;
  
  // Personalização
  customThemes: CustomTheme[];
  activeThemeId?: string;
  defaultWatermark: WatermarkSettings;
  emailTemplates: EmailTemplate[];
  faviconUrl?: string;
  discountPresets: DiscountPreset[];
}

export interface ExportData {
  filename: string;
  selected: boolean;
}

export type ClientGalleryStatus = 'ativo' | 'sem_galeria';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  galleryPassword: string;
  status: ClientGalleryStatus;
  totalGalleries: number;
  createdAt: Date;
  updatedAt: Date;
}
