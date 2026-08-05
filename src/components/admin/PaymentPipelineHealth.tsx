import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Versão esperada do pipeline de pagamento de galeria.
 * Deve bater com GCP_VERSION (gallery-create-payment), IPCL_VERSION e MPCL_VERSION.
 * Ao subir versão nas edges, atualizar aqui NA MESMA edição.
 */
const EXPECTED_VERSION = 'v2.2.1';

const FUNCTIONS = [
  'gallery-create-payment',
  'infinitepay-create-link',
  'mercadopago-create-link',
] as const;

type PingResult = {
  fn: string;
  version: string;
  ok: boolean;
};

export function PaymentPipelineHealth() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PingResult[] | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setResults(null);
    const out: PingResult[] = [];

    for (const fn of FUNCTIONS) {
      try {
        const { data, error } = await supabase.functions.invoke(fn, { body: { ping: true } });
        const version = (data as { version?: string } | null)?.version ?? 'desconhecida';
        out.push({ fn, version: error ? 'erro' : version, ok: !error && version === EXPECTED_VERSION });
      } catch {
        out.push({ fn, version: 'erro', ok: false });
      }
    }

    setResults(out);
    setLoading(false);
  };

  const hasDrift = results?.some((r) => !r.ok);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Saúde do pipeline de pagamento
        </CardTitle>
        <CardDescription>
          Confere a versão publicada de cada função contra a versão esperada ({EXPECTED_VERSION}).
          Divergência significa deploy desatualizado — refaça o deploy antes de testar com cliente real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runCheck} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Verificar versões
        </Button>

        {results && (
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.fn}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs sm:text-sm">{r.fn}</span>
                <span className={`flex items-center gap-1.5 ${r.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                  {r.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {r.version}
                </span>
              </div>
            ))}

            {hasDrift && (
              <p className="text-xs text-destructive">
                Drift detectado. Refaça o deploy conjunto de gallery-create-payment, confirm-selection,
                client-selection, infinitepay-create-link e mercadopago-create-link.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
