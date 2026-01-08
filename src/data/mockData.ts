import { GlobalSettings } from '@/types/gallery';

// Mock galleries removed - now using only Supabase
// This file only contains global settings and default messages

export const mockGlobalSettings: GlobalSettings = {
  // Configurações gerais
  defaultGalleryPermission: 'private',
  clientTheme: 'system',
  defaultExpirationDays: 10,
  studioName: 'Studio Lunari',
  studioLogo: undefined,
  
  // Personalização
  customThemes: [
    {
      id: 'theme-default',
      name: 'Padrão',
      primaryColor: '#B87333',
      backgroundColor: '#FAFAF8',
      textColor: '#2D2A26',
      accentColor: '#8B9A7D',
      isDefault: true,
    },
    {
      id: 'theme-elegant',
      name: 'Elegante',
      primaryColor: '#1A1A1A',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A1A',
      accentColor: '#C9A96E',
      isDefault: false,
    },
    {
      id: 'theme-romantic',
      name: 'Romântico',
      primaryColor: '#D4A5A5',
      backgroundColor: '#FDF8F8',
      textColor: '#4A3F3F',
      accentColor: '#B8D4C8',
      isDefault: false,
    },
  ],
  activeThemeId: 'theme-default',
  defaultWatermark: {
    type: 'standard',
    opacity: 40,
    position: 'center',
  },
  emailTemplates: [
    {
      id: 'email-gallery-sent',
      name: 'Galeria Enviada',
      type: 'gallery_sent',
      subject: 'Suas fotos estão prontas! - {galeria}',
      body: 'Olá {cliente}!\n\nSuas fotos da sessão "{galeria}" estão prontas para visualização.\n\nAcesse o link abaixo para ver suas fotos e fazer sua seleção:\n{link}\n\nVocê tem até {prazo} para fazer sua seleção.\n\nCom carinho,\n{estudio}',
    },
    {
      id: 'email-reminder',
      name: 'Lembrete de Prazo',
      type: 'selection_reminder',
      subject: 'Lembrete: Sua seleção expira em breve - {galeria}',
      body: 'Olá {cliente}!\n\nEste é um lembrete amigável de que sua seleção da galeria "{galeria}" expira em {dias_restantes} dias.\n\nNão perca o prazo! Acesse o link abaixo:\n{link}\n\nCom carinho,\n{estudio}',
    },
    {
      id: 'email-confirmed',
      name: 'Seleção Confirmada',
      type: 'selection_confirmed',
      subject: 'Seleção confirmada! - {galeria}',
      body: 'Olá {cliente}!\n\nSua seleção da galeria "{galeria}" foi confirmada com sucesso!\n\nTotal de fotos selecionadas: {total_fotos}\nFotos extras: {fotos_extras}\nValor adicional: R$ {valor_extra}\n\nEm breve entraremos em contato com mais informações.\n\nCom carinho,\n{estudio}',
    },
  ],
  faviconUrl: undefined,
  discountPresets: [],
};

export const defaultWelcomeMessage = `Olá {cliente}! 💕

É com muito carinho que compartilho as fotos da sua sessão de {sessao}.

Selecione suas favoritas com calma e aproveite cada momento capturado!

Com carinho,
{estudio}`;
