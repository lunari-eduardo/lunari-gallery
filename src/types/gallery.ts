export type GalleryStatus = 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled';
export type TitleCaseMode = 'normal' | 'uppercase' | 'titlecase';

// Gestão integration - parameters received via URL when creating gallery from Gestão
export interface GestaoSessionParams {
  session_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  pacote_categoria?: string;  // Maps to session name
  pacote_nome?: string;       // Maps to package name
  fotos_incluidas_no_pacote?: number;
  preco_da_foto_extra?: number;
  modelo_de_cobranca?: SaleMode;     // 'no_sale' | 'sale_with_payment' | 'sale_without_payment'
  modelo_de_preco?: PricingModel;    // 'fixed' | 'packages'
}
export type SelectionStatus = 'in_progress' | 'confirmed' | 'blocked';
export type WatermarkType = 'none' | 'standard' | 'custom';
export type DeadlinePreset = 7 | 10 | 15 | 'custom';
export type ImageResizeOption = 1024 | 1920 | 2560;
export type WatermarkDisplay = 'all' | 'fullscreen' | 'none';
export type GalleryPermission = 'public' | 'private';
export type GalleryOrigin = 'manual' | 'gestao';

// Tipos para configuração de venda
export type SaleMode = 'no_sale' | 'sale_with_payment' | 'sale_without_payment';
export type PricingModel = 'fixed' | 'packages';
export type ChargeType = 'all_selected' | 'only_extras';
export type PaymentMethod = 'pix_manual' | 'infinitepay' | 'mercadopago';

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
  paymentMethod?: PaymentMethod; // Payment method selected for this gallery
}

export interface WatermarkSettings {
  type: WatermarkType;
  opacity: number;
  position: 'center'; // Standard watermark always uses center
  // Preparação para watermarks customizadas (futuro)
  customHorizontalUrl?: string;
  customVerticalUrl?: string;
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
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
}

export interface GalleryPhoto {
  id: string;
  filename: string;           // UUID técnico para storage
  originalFilename: string;   // Nome original do arquivo (DSC_0001.jpg)
  displayName?: string;       // Nome de exibição customizado (opcional)
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  storageKey?: string;        // B2 storage path for original download (without watermark)
  originalPath?: string | null; // B2 path for download (only when allowDownload=true)
  width: number;
  height: number;
  isSelected: boolean;
  isFavorite: boolean;        // Foto favoritada pelo cliente
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

// Tema personalizado para galerias do cliente (simplificado)
export interface CustomTheme {
  id: string;
  name: string;
  backgroundMode: 'light' | 'dark';  // Apenas claro ou escuro
  primaryColor: string;              // Botões, CTAs
  accentColor: string;               // Seleções, bordas ativas
  emphasisColor: string;             // Títulos, valores destacados
}

// Configuração de tema no nível do fotógrafo
export type ThemeType = 'system' | 'custom';

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
  
  // Personalização - tema único (simplificado)
  themeType: ThemeType;
  customTheme?: CustomTheme;  // Único tema personalizado (se houver)
  activeThemeId?: string;     // ID do tema ativo (para compatibilidade)
  defaultWatermark: WatermarkSettings;
  emailTemplates: EmailTemplate[];
  faviconUrl?: string;
  discountPresets: DiscountPreset[];
  lastSessionFont?: string;
  defaultWelcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
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
  galleryPassword?: string;
  status: ClientGalleryStatus;
  totalGalleries: number;
  createdAt: Date;
  updatedAt: Date;
}
