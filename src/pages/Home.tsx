import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGalleryCredits } from '@/hooks/useGalleryCredits';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useSupabaseGalleries, Galeria } from '@/hooks/useSupabaseGalleries';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  HardDrive,
  Images,
  Send,
  CheckCircle2,
  DollarSign,
  Clock,
  AlertCircle,
  ExternalLink,
  Activity,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { differenceInDays, format, startOfMonth, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Criadas', color: '#C9CED6' },
  enviado: { label: 'Enviadas', color: '#4A90E2' },
  selecao_iniciada: { label: 'Em seleção', color: '#F28C52' },
  selecao_completa: { label: 'Concluídas', color: '#4CAF7A' },
  expirado: { label: 'Expiradas', color: '#F26B6B' },
};

function getStatusBadge(status: string) {
  const map = STATUS_MAP[status];
  if (!map) return <Badge variant="secondary">{status}</Badge>;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: map.color + '18', color: map.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: map.color }} />
      {map.label}
    </span>
  );
}

/* ─── 3D Orbital Scene — Death Globe ─── */
const TERRA_COTA = ['#c2956a', '#d2691e', '#cd853f', '#b8652a', '#a0522d', '#d4a574', '#e8c4a0', '#e0b48c'];

const RING_CONFIGS = [
  { color: TERRA_COTA[0], rotation: [Math.PI / 2, 0, 0] as [number, number, number], speed: 0.024 },
  { color: TERRA_COTA[1], rotation: [0, 0, 0] as [number, number, number], speed: 0.02 },
  { color: TERRA_COTA[2], rotation: [Math.PI / 4, Math.PI / 4, 0] as [number, number, number], speed: 0.016 },
  { color: TERRA_COTA[3], rotation: [-Math.PI / 4, Math.PI / 4, 0] as [number, number, number], speed: 0.028 },
];

const SPHERE_CONFIGS = [
  { ringIndex: 0, speed: 0.096, offset: 0, size: 0.06 },
  { ringIndex: 0, speed: 0.08, offset: Math.PI, size: 0.048 },
  { ringIndex: 2, speed: 0.064, offset: 1.2, size: 0.072 },
];

function TorusRing({ index, isDark }: { index: number; isDark: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const cfg = RING_CONFIGS[index];

  useFrame((_, delta) => {
    ref.current.rotation.y += cfg.speed * delta;
  });

  const opacity = isDark ? 0.10 + index * 0.04 : 0.1 + index * 0.03;

  return (
    <mesh ref={ref} rotation={cfg.rotation}>
      <torusGeometry args={[6.0, 0.012, 16, 120]} />
      <meshBasicMaterial color={cfg.color} transparent opacity={opacity} />
    </mesh>
  );
}

function OrbitingSphere({ index, isDark }: { index: number; isDark: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const cfg = SPHERE_CONFIGS[index];
  const ring = RING_CONFIGS[cfg.ringIndex];
  const timeRef = useRef(cfg.offset);
  const quat = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(...ring.rotation)), [ring.rotation]);
  const localPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    timeRef.current += delta * cfg.speed;
    const angle = timeRef.current;
    localPos.set(Math.cos(angle) * 6, Math.sin(angle) * 6, 0);
    localPos.applyQuaternion(quat);
    ref.current.position.copy(localPos);
  });

  const opacity = isDark ? 0.4 + (index % 3) * 0.1 : 0.3 + (index % 3) * 0.1;
  const color = TERRA_COTA[index % 8];

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[cfg.size, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function OrbitalScene({ isDark }: { isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += 0.032 * delta;
  });

  return (
    <group ref={groupRef}>
      {RING_CONFIGS.map((_, i) => (
        <TorusRing key={i} index={i} isDark={isDark} />
      ))}
      {SPHERE_CONFIGS.map((_, i) => (
        <OrbitingSphere key={i} index={i} isDark={isDark} />
      ))}
    </group>
  );
}

/* ─── Background with 3D orbits + glow + noise ─── */
function DashboardBackground() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0a0608 0%, #1a0f08 50%, #0d0705 100%)'
            : 'linear-gradient(135deg, #fdf0e6 0%, #f5dcc4 50%, #fdf0e6 100%)',
        }}
      />

      {/* 3D Canvas */}
      {!reducedMotion && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 10], fov: 60 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
            dpr={[1, 1.5]}
          >
            <OrbitalScene isDark={isDark} />
          </Canvas>
        </div>
      )}

      {/* Glow zones */}
      <div
        className="absolute rounded-full"
        style={{
          width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, hsl(24 35% 59% / 0.12), transparent 70%)',
          top: '10%', left: '30%',
          filter: 'blur(80px)',
          opacity: isDark ? 0.05 : 0.08,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '35vw', height: '35vw',
          background: 'radial-gradient(circle, hsl(20 50% 44% / 0.15), transparent 70%)',
          top: '45%', right: '20%',
          filter: 'blur(100px)',
          opacity: isDark ? 0.04 : 0.07,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '30vw', height: '30vw',
          background: 'radial-gradient(circle, hsl(24 70% 42% / 0.12), transparent 70%)',
          bottom: '5%', left: '15%',
          filter: 'blur(90px)',
          opacity: isDark ? 0.05 : 0.06,
        }}
      />

      {/* Noise overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
        <filter id="dashboard-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dashboard-noise)" />
      </svg>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { credits, isLoading: creditsLoading } = useGalleryCredits();
  const { storageUsedBytes, storageLimitBytes, storageUsedPercent, planName, isLoading: storageLoading } = useTransferStorage();
  const { galleries, isLoading: galleriesLoading } = useSupabaseGalleries();

  // Recent activity
  const { data: recentActions = [] } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('galeria_acoes')
        .select('id, tipo, descricao, created_at, galeria_id, galerias(nome_sessao, cliente_nome)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    enabled: !!user,
  });

  // Monthly metrics
  const monthStart = startOfMonth(new Date());
  const metrics = useMemo(() => {
    const selecaoGalleries = galleries.filter(g => g.tipo === 'selecao');
    const thisMonth = selecaoGalleries.filter(g => isAfter(g.createdAt, monthStart));
    const sentThisMonth = selecaoGalleries.filter(g => g.enviadoEm && isAfter(g.enviadoEm, monthStart));
    const completedThisMonth = selecaoGalleries.filter(g => g.status === 'selecao_completa' && g.finalizedAt && isAfter(g.finalizedAt, monthStart));
    const extrasThisMonth = completedThisMonth.reduce((sum, g) => sum + (g.valorExtras || 0), 0);
    return {
      created: thisMonth.length,
      sent: sentThisMonth.length,
      completed: completedThisMonth.length,
      extras: extrasThisMonth,
    };
  }, [galleries, monthStart]);

  // Status chart data
  const statusData = useMemo(() => {
    const selecaoGalleries = galleries.filter(g => g.tipo === 'selecao');
    const counts: Record<string, number> = {};
    selecaoGalleries.forEach(g => {
      const s = g.status;
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(STATUS_MAP)
      .map(([key, val]) => ({ name: val.label, value: counts[key] || 0, color: val.color }))
      .filter(d => d.value > 0);
  }, [galleries]);

  // Galleries requiring attention
  const attentionGalleries = useMemo(() => {
    const now = new Date();
    return galleries
      .filter(g => g.tipo === 'selecao')
      .filter(g => {
        if (g.status === 'enviado') return true;
        if (g.status === 'selecao_iniciada' && g.prazoSelecao) {
          const daysLeft = differenceInDays(g.prazoSelecao, now);
          return daysLeft <= 3;
        }
        return false;
      })
      .slice(0, 6);
  }, [galleries]);

  return (
    <>
      <DashboardBackground />
      <div className="-mx-4 md:-mx-8 -mt-6 md:-mt-8 min-h-screen">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-8 relative z-10">
          {/* Section 1 — Account Resources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Credits Card */}
            <div className="glass p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-xl bg-primary/10 p-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Créditos de galerias</h3>
              </div>
              <div className="mb-1">
                <span className="text-4xl font-bold text-foreground">
                  {creditsLoading ? '—' : credits.toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">créditos disponíveis</p>
              <p className="text-xs text-muted-foreground/70 mb-5">Seus créditos não expiram</p>
              <Button variant="terracotta" className="w-full sm:w-auto" onClick={() => navigate('/credits')}>
                Comprar créditos
              </Button>
            </div>

            {/* Storage Card */}
            <div className="glass p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-xl bg-primary/10 p-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Armazenamento</h3>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{planName || 'Plano Gratuito'}</p>
              <p className="text-sm text-muted-foreground mb-3">
                {storageLoading ? '—' : `${formatBytes(storageUsedBytes)} de ${formatBytes(storageLimitBytes)} usados`}
              </p>
              <Progress value={storageUsedPercent} className="h-2 mb-5" />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => navigate('/credits/subscription')}>
                  Ver planos de armazenamento
                </Button>
                <button
                  onClick={() => navigate('/credits/subscription')}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Gerenciar assinatura
                </button>
              </div>
            </div>
          </div>

          {/* Section 2 — Monthly Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[
              { icon: Images, label: 'Galerias criadas', value: metrics.created, sub: 'este mês' },
              { icon: Send, label: 'Galerias enviadas', value: metrics.sent, sub: 'clientes convidados' },
              { icon: CheckCircle2, label: 'Seleções concluídas', value: metrics.completed, sub: 'clientes finalizaram' },
              { icon: DollarSign, label: 'Vendas extras', value: formatCurrency(metrics.extras), sub: 'fotos adicionais este mês' },
            ].map((m, i) => (
              <div key={i} className="glass p-6 hover:-translate-y-1 cursor-default">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-xl bg-primary/10 group-hover:bg-primary/20 p-1.5">
                    <m.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{galleriesLoading ? '—' : m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Section 3 & 4 row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
            {/* Status Overview */}
            <div className="lg:col-span-2 glass p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Status das galerias</h3>
              {statusData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma galeria criada</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-[140px] h-[140px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3} strokeWidth={0}>
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, 'galerias']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2">
                    {statusData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-semibold text-foreground ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attention Required */}
            <div className="lg:col-span-3 glass p-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">Aguardando ação</h3>
              </div>
              {attentionGalleries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma galeria precisa de atenção</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border/50">
                        <th className="text-left pb-2 font-medium">Cliente</th>
                        <th className="text-left pb-2 font-medium hidden sm:table-cell">Sessão</th>
                        <th className="text-left pb-2 font-medium">Status</th>
                        <th className="text-left pb-2 font-medium hidden md:table-cell">Seleção</th>
                        <th className="text-left pb-2 font-medium">Prazo</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {attentionGalleries.map(g => {
                        const daysLeft = g.prazoSelecao ? differenceInDays(g.prazoSelecao, new Date()) : null;
                        return (
                          <tr key={g.id} className="border-b border-border/30 last:border-0">
                            <td className="py-2.5 font-medium text-foreground">{g.clienteNome || '—'}</td>
                            <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{g.nomeSessao || '—'}</td>
                            <td className="py-2.5">{getStatusBadge(g.status)}</td>
                            <td className="py-2.5 text-muted-foreground hidden md:table-cell">
                              {g.fotosSelecionadas} / {g.fotosIncluidas}
                            </td>
                            <td className="py-2.5">
                              {daysLeft !== null ? (
                                <span className={`text-xs font-medium ${daysLeft <= 1 ? 'text-destructive' : daysLeft <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                  {daysLeft <= 0 ? 'Expirado' : `${daysLeft}d restantes`}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/gallery/${g.id}`)}>
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Abrir
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 5 — Recent Activity */}
          <div className="glass p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Atividades recentes</h3>
            </div>
            {recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-3">
                {recentActions.map((action: any) => {
                  const gallery = action.galerias;
                  const galleryLabel = gallery?.nome_sessao || gallery?.cliente_nome || 'Galeria';
                  return (
                    <div key={action.id} className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          {action.descricao || action.tipo} — <span className="text-muted-foreground">{galleryLabel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(action.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
