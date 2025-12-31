import { useState } from 'react';
import { Mail, Pencil, Send, Bell, CheckCircle } from 'lucide-react';
import { EmailTemplate } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { EmailTemplateModal } from './EmailTemplateModal';

interface EmailTemplatesProps {
  templates: EmailTemplate[];
  onTemplatesChange: (templates: EmailTemplate[]) => void;
}

const getTemplateIcon = (type: EmailTemplate['type']) => {
  switch (type) {
    case 'gallery_sent':
      return Send;
    case 'selection_reminder':
      return Bell;
    case 'selection_confirmed':
      return CheckCircle;
    default:
      return Mail;
  }
};

export function EmailTemplates({ templates, onTemplatesChange }: EmailTemplatesProps) {
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const handleSaveTemplate = (template: EmailTemplate) => {
    const updated = templates.map((t) =>
      t.id === template.id ? template : t
    );
    onTemplatesChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Textos de E-mails</h3>
          <p className="text-sm text-muted-foreground">
            Personalize as mensagens enviadas aos clientes
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => {
          const Icon = getTemplateIcon(template.type);
          return (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                    {template.subject}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingTemplate(template)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          );
        })}
      </div>

      <EmailTemplateModal
        open={editingTemplate !== null}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}
