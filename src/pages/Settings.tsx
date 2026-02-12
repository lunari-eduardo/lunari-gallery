import { Save } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { PersonalizationSettings } from '@/components/settings/PersonalizationSettings';
import { PaymentSettings } from '@/components/settings/PaymentSettings';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const location = useLocation();
  
  // Detect if returning from Mercado Pago OAuth callback
  const params = new URLSearchParams(location.search);
  const isMpCallback = params.has('mp_callback') || params.get('tab') === 'payment';

  const handleSave = () => {
    toast.success('Configurações salvas!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Configurações globais do seu estúdio
        </p>
      </div>

      <Tabs defaultValue={isMpCallback ? "payment" : "general"} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="personalization">Personalização</TabsTrigger>
          <TabsTrigger value="payment">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettings settings={settings} updateSettings={updateSettings} />
        </TabsContent>

        <TabsContent value="personalization" className="mt-6">
          <PersonalizationSettings />
        </TabsContent>

        <TabsContent value="payment" className="mt-6">
          <PaymentSettings />
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="terracotta" size="lg" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
