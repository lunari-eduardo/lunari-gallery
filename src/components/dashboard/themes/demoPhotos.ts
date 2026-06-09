import { PhotoPaths } from '@/lib/photoUrl';

// Usaremos imagens de alta qualidade via CDN para garantir o carregamento estável no preview
// Preservamos proporções realistas (3:2 horizontal e 2:3 vertical)
export const DEMO_PHOTOS = [
  {
    id: '1',
    storageKey: 'demo1',
    originalFilename: 'casamento-01.jpg',
    width: 1500,
    height: 1000,
    previewPath: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1500&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop',
    peso_visual: 1
  },
  {
    id: '2',
    storageKey: 'demo2',
    originalFilename: 'casamento-02.jpg',
    width: 1000,
    height: 1500,
    previewPath: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1000&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '3',
    storageKey: 'demo3',
    originalFilename: 'casamento-03.jpg',
    width: 1000,
    height: 1500,
    previewPath: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '4',
    storageKey: 'demo4',
    originalFilename: 'casamento-04.jpg',
    width: 1500,
    height: 1000,
    previewPath: 'https://images.unsplash.com/photo-1465495910483-0d6749ee9f4a?q=80&w=1500&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1465495910483-0d6749ee9f4a?q=80&w=600&auto=format&fit=crop',
    peso_visual: 1
  },
  {
    id: '5',
    storageKey: 'demo5',
    originalFilename: 'casamento-05.jpg',
    width: 1500,
    height: 1000,
    previewPath: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1500&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: '6',
    storageKey: 'demo6',
    originalFilename: 'casamento-06.jpg',
    width: 1000,
    height: 1500,
    previewPath: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=1000&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '7',
    storageKey: 'demo7',
    originalFilename: 'casamento-07.jpg',
    width: 1000,
    height: 1500,
    previewPath: 'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?q=80&w=1000&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '8',
    storageKey: 'demo8',
    originalFilename: 'casamento-08.jpg',
    width: 1500,
    height: 1000,
    previewPath: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?q=80&w=1500&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: '9',
    storageKey: 'demo9',
    originalFilename: 'casamento-09.jpg',
    width: 1000,
    height: 1500,
    previewPath: 'https://images.unsplash.com/photo-1522673607200-16489de436c3?q=80&w=1000&auto=format&fit=crop',
    thumbPath: 'https://images.unsplash.com/photo-1522673607200-16489de436c3?q=80&w=400&auto=format&fit=crop',
  }
];