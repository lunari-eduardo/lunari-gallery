import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VisualThemeConfig, ThemePresetId, VisualThemeMode } from '@/lib/visualTheme';

/**
 * Sincroniza o tema do usuário em `user_theme_preferences` (Supabase compartilhado
 * com o Studio).
 * - Hidrata ao logar
 * - Upsert debounced ao mudar
 * - Realtime: reflete mudanças feitas em outras abas / no Studio
 */
export function useRemoteThemeSync(
  theme: VisualThemeConfig,
  applyRemote: (next: VisualThemeConfig) => void,
) {
  const lastSavedRef = useRef<string>('');
  const debounceRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Hidratação + assinatura realtime quando autenticado
  useEffect(() => {
    let cancelled = false;

    const cleanupChannel = () => {
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch { /* ignore */ }
        channelRef.current = null;
      }
    };

    const subscribeRealtime = (userId: string) => {
      cleanupChannel();
      const channel = supabase
        .channel(`user-theme:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_theme_preferences',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            const row = (payload?.new ?? payload?.old) as
              | { preset_id?: string; mode?: string }
              | undefined;
            if (!row?.preset_id || !row?.mode) return;
            const next: VisualThemeConfig = {
              presetId: row.preset_id as ThemePresetId,
              mode: row.mode as VisualThemeMode,
            };
            const serialized = JSON.stringify(next);
            // Guarda contra eco do próprio upsert local
            if (serialized === lastSavedRef.current) return;
            lastSavedRef.current = serialized;
            applyRemote(next);
          }
        )
        .subscribe();
      channelRef.current = channel;
    };

    const hydrate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        hydratedRef.current = true;
        return;
      }
      const { data, error } = await supabase
        .from('user_theme_preferences')
        .select('preset_id, mode')
        .eq('user_id', user.id)
        .maybeSingle();

      subscribeRealtime(user.id);

      if (cancelled || error || !data) {
        hydratedRef.current = true;
        return;
      }
      const next: VisualThemeConfig = {
        presetId: data.preset_id as ThemePresetId,
        mode: data.mode as VisualThemeMode,
      };
      lastSavedRef.current = JSON.stringify(next);
      hydratedRef.current = true;
      applyRemote(next);
    };

    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') hydrate();
      if (event === 'SIGNED_OUT') cleanupChannel();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      cleanupChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upsert debounced quando o tema muda
  useEffect(() => {
    if (!hydratedRef.current) return;
    const serialized = JSON.stringify(theme);
    if (serialized === lastSavedRef.current) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('user_theme_preferences')
        .upsert(
          { user_id: user.id, preset_id: theme.presetId, mode: theme.mode },
          { onConflict: 'user_id' }
        );
      if (!error) lastSavedRef.current = serialized;
    }, 400);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [theme]);
}
