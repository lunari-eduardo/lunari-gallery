import { Gallery, GlobalSettings, GalleryPhoto } from '@/types/gallery';

const generateMockPhotos = (count: number): GalleryPhoto[] => {
  const aspectRatios = [
    { width: 1200, height: 800 },
    { width: 800, height: 1200 },
    { width: 1000, height: 1000 },
    { width: 1400, height: 900 },
    { width: 900, height: 1400 },
    { width: 1200, height: 750 },
  ];

  return Array.from({ length: count }, (_, i) => {
    const aspect = aspectRatios[i % aspectRatios.length];
    const photoId = i + 1;
    return {
      id: `photo-${photoId}`,
      filename: `IMG_${String(photoId).padStart(4, '0')}.jpg`,
      thumbnailUrl: `https://picsum.photos/seed/${photoId}/400/400`,
      previewUrl: `https://picsum.photos/seed/${photoId}/${aspect.width}/${aspect.height}`,
      originalUrl: `https://picsum.photos/seed/${photoId}/${aspect.width * 2}/${aspect.height * 2}`,
      width: aspect.width,
      height: aspect.height,
      isSelected: false,
      order: i,
    };
  });
};

export const mockGalleries: Gallery[] = [
  {
    id: 'gallery-1',
    clientName: 'Maria Silva',
    clientEmail: 'maria.silva@email.com',
    sessionName: 'Ensaio Gestante',
    packageName: 'Pacote Premium',
    includedPhotos: 30,
    extraPhotoPrice: 25,
    status: 'selection_started',
    selectionStatus: 'in_progress',
    settings: {
      welcomeMessage: 'Olá Maria! 💕\n\nÉ com muito carinho que compartilho as fotos do seu ensaio gestante. Cada clique captura a beleza desse momento único.\n\nSelecione suas favoritas com calma e aproveite cada memória!',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      deadlinePreset: 7,
      watermark: {
        type: 'text',
        text: 'Studio Lunari',
        opacity: 30,
        position: 'bottom-right',
      },
      previewResolution: 'medium',
      allowComments: true,
      downloadOption: 'after_selection',
      allowExtraPhotos: true,
    },
    photos: generateMockPhotos(45),
    actions: [
      { id: 'a1', type: 'created', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), description: 'Galeria criada' },
      { id: 'a2', type: 'sent', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), description: 'Link enviado para cliente' },
      { id: 'a3', type: 'client_started', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), description: 'Cliente iniciou seleção' },
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    selectedCount: 12,
    extraCount: 0,
    extraTotal: 0,
  },
  {
    id: 'gallery-2',
    clientName: 'João e Ana Costa',
    clientEmail: 'joao.ana@email.com',
    sessionName: 'Casamento',
    packageName: 'Pacote Completo',
    includedPhotos: 100,
    extraPhotoPrice: 35,
    status: 'selection_completed',
    selectionStatus: 'confirmed',
    settings: {
      welcomeMessage: 'Queridos João e Ana,\n\nQue honra ter registrado o dia mais especial de vocês! Cada foto conta um pedacinho da história de amor de vocês.\n\nEscolham com carinho as memórias que vão eternizar.',
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      deadlinePreset: 15,
      watermark: {
        type: 'logo',
        logoUrl: '/logo.png',
        opacity: 25,
        position: 'bottom-right',
      },
      previewResolution: 'high',
      allowComments: true,
      downloadOption: 'after_selection',
      allowExtraPhotos: true,
    },
    photos: generateMockPhotos(180).map((p, i) => ({ ...p, isSelected: i < 115 })),
    actions: [
      { id: 'a1', type: 'created', timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), description: 'Galeria criada' },
      { id: 'a2', type: 'sent', timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), description: 'Link enviado para cliente' },
      { id: 'a3', type: 'client_started', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), description: 'Cliente iniciou seleção' },
      { id: 'a4', type: 'client_confirmed', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), description: 'Seleção confirmada pelo cliente' },
    ],
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    selectedCount: 115,
    extraCount: 15,
    extraTotal: 525,
  },
  {
    id: 'gallery-3',
    clientName: 'Pedro Oliveira',
    clientEmail: 'pedro.oliveira@email.com',
    sessionName: 'Ensaio Corporativo',
    packageName: 'Pacote Executivo',
    includedPhotos: 15,
    extraPhotoPrice: 40,
    status: 'sent',
    selectionStatus: 'in_progress',
    settings: {
      welcomeMessage: 'Olá Pedro!\n\nSuas fotos corporativas estão prontas. Selecione as que melhor representam sua imagem profissional.',
      deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      deadlinePreset: 10,
      watermark: {
        type: 'text',
        text: 'Studio Lunari',
        opacity: 20,
        position: 'center',
      },
      previewResolution: 'medium',
      allowComments: false,
      downloadOption: 'disabled',
      allowExtraPhotos: false,
    },
    photos: generateMockPhotos(25),
    actions: [
      { id: 'a1', type: 'created', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), description: 'Galeria criada' },
      { id: 'a2', type: 'sent', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), description: 'Link enviado para cliente' },
    ],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    selectedCount: 0,
    extraCount: 0,
    extraTotal: 0,
  },
  {
    id: 'gallery-4',
    clientName: 'Família Rodrigues',
    clientEmail: 'familia.rodrigues@email.com',
    sessionName: 'Ensaio Família',
    packageName: 'Pacote Família',
    includedPhotos: 40,
    extraPhotoPrice: 20,
    status: 'expired',
    selectionStatus: 'blocked',
    settings: {
      welcomeMessage: 'Querida Família Rodrigues,\n\nFoi maravilhoso capturar esses momentos especiais de vocês juntos!',
      deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      deadlinePreset: 7,
      watermark: {
        type: 'none',
        opacity: 0,
        position: 'bottom-right',
      },
      previewResolution: 'low',
      allowComments: true,
      downloadOption: 'allowed',
      allowExtraPhotos: true,
    },
    photos: generateMockPhotos(55).map((p, i) => ({ ...p, isSelected: i < 25 })),
    actions: [
      { id: 'a1', type: 'created', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), description: 'Galeria criada' },
      { id: 'a2', type: 'sent', timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), description: 'Link enviado para cliente' },
      { id: 'a3', type: 'client_started', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), description: 'Cliente iniciou seleção' },
      { id: 'a4', type: 'expired', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), description: 'Prazo expirado' },
    ],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    selectedCount: 25,
    extraCount: 0,
    extraTotal: 0,
  },
  {
    id: 'gallery-5',
    clientName: 'Carolina Mendes',
    clientEmail: 'carol.mendes@email.com',
    sessionName: '15 Anos',
    packageName: 'Pacote Debutante',
    includedPhotos: 50,
    extraPhotoPrice: 30,
    status: 'created',
    selectionStatus: 'in_progress',
    settings: {
      welcomeMessage: 'Oi Carol! ✨\n\nSeu ensaio de 15 anos ficou incrível! Prepare-se para escolher as fotos mais lindas!',
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      deadlinePreset: 15,
      watermark: {
        type: 'text',
        text: 'Studio Lunari',
        opacity: 35,
        position: 'bottom-left',
      },
      previewResolution: 'high',
      allowComments: true,
      downloadOption: 'after_selection',
      allowExtraPhotos: true,
    },
    photos: generateMockPhotos(70),
    actions: [
      { id: 'a1', type: 'created', timestamp: new Date(), description: 'Galeria criada' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    selectedCount: 0,
    extraCount: 0,
    extraTotal: 0,
  },
];

export const mockGlobalSettings: GlobalSettings = {
  publicGalleryEnabled: true,
  clientTheme: 'system',
  language: 'pt-BR',
  defaultExpirationDays: 10,
  studioName: 'Studio Lunari',
  studioLogo: undefined,
};

export const defaultWelcomeMessage = `Olá {cliente}! 💕

É com muito carinho que compartilho as fotos da sua sessão de {sessao}.

Selecione suas favoritas com calma e aproveite cada momento capturado!

Com carinho,
{estudio}`;
