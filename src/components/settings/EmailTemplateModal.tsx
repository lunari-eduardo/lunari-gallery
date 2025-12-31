import { useState, useEffect } from 'react';
import { EmailTemplate } from '@/types/gallery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface EmailTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  onSave: (template: EmailTemplate) => void;
}

const VARIABLES = [
  { key: '{cliente}', desc: 'Nome do cliente' },
  { key: '{galeria}', desc: 'Nome da galeria' },
  { key: '{prazo}', desc: 'Data limite' },
  { key: '{link}', desc: 'Link da galeria' },
  { key: '{estudio}', desc: 'Nome do estúdio' },
  { key: '{dias_restantes}', desc: 'Dias restantes' },
  { key: '{total_fotos}', desc: 'Total de fotos' },
  { key: '{fotos_extras}', desc: 'Fotos extras' },
  { key: '{valor_extra}', desc: 'Valor das extras' },
];

export function EmailTemplateModal({
  open,
  onOpenChange,
  template,
  onSave,
}: EmailTemplateModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template, open]);

  const handleSave = () => {
    if (!template) return;
    onSave({
      ...template,
      subject,
      body,
    });
    onOpenChange(false);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('emailBody') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + variable + body.substring(end);
      setBody(newBody);
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setBody(body + variable);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar Template: {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="emailSubject">Assunto do E-mail</Label>
            <Input
              id="emailSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do e-mail..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="emailBody">Corpo do E-mail</Label>
            <Textarea
              id="emailBody"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Conteúdo do e-mail..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Clique para inserir variáveis:
            </Label>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => insertVariable(v.key)}
                >
                  {v.key}
                  <span className="ml-1 text-muted-foreground font-normal">
                    {v.desc}
                  </span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="font-medium text-sm mb-2">
                Assunto: {subject.replace(/{(\w+)}/g, '[$1]')}
              </p>
              <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-sans">
                {body.replace(/{(\w+)}/g, '[$1]')}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="terracotta" onClick={handleSave}>
            Salvar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
