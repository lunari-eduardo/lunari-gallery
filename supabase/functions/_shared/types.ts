// supabase/functions/_shared/types.ts

export interface FaixaPreco {
  min: number;
  max: number | null;
  valor: number;
}

export interface TabelaPrecos {
  faixas: FaixaPreco[];
}

export interface PrecificacaoFotoExtra {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
}

export interface RegrasCongeladas {
  modelo: string;
  pacote?: {
    valorFotoExtra?: number;
  };
  precificacaoFotoExtra?: PrecificacaoFotoExtra;
}

export interface SaleSettings {
  mode?: 'view_only' | 'selection' | 'sale';
  paymentMethod?: 'asaas' | 'mercadopago' | 'infinitepay' | 'manual';
  chargeType?: 'only_extras' | 'all_selected';
}

export interface GalleryConfig {
  saleSettings?: SaleSettings;
  [key: string]: any;
}

export interface Gallery {
  id: string;
  user_id: string;
  status: string;
  status_selecao: string;
  fotos_incluidas: number;
  valor_foto_extra: number;
  configuracoes: GalleryConfig | null;
  regras_congeladas: RegrasCongeladas | null;
  total_fotos_extras_vendidas: number | null;
  valor_total_vendido: number | null;
  session_id?: string | null;
  public_token?: string | null;
}
