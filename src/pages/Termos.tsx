import { LegalPageLayout, Section } from '@/components/legal/LegalPageLayout';

export default function Termos() {
  return (
    <LegalPageLayout
      title="Termos de Serviço — Lunari Gallery"
      description="Termos e condições de uso da plataforma Lunari Gallery para fotógrafos e clientes finais."
      canonical="https://gallery.lunarihub.com/termos"
      updatedAt="18 de maio de 2026"
    >
      <Section n={1} title="Sobre o serviço">
        <p>O Lunari Gallery oferece soluções para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Seleção de fotografias</li>
          <li>Aprovação de imagens</li>
          <li>Entrega digital de arquivos</li>
          <li>Compartilhamento de galerias online</li>
        </ul>
      </Section>

      <Section n={2} title="Responsabilidade do usuário">
        <p>O fotógrafo usuário é responsável por:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Todo conteúdo enviado</li>
          <li>Direitos autorais das imagens</li>
          <li>Consentimento de clientes fotografados</li>
          <li>Backup próprio dos arquivos importantes</li>
        </ul>
      </Section>

      <Section n={3} title="Uso proibido">
        <p>É proibido utilizar a plataforma para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Conteúdo ilegal</li>
          <li>Violação de direitos autorais</li>
          <li>Material ofensivo ou ilícito</li>
          <li>Distribuição de malware</li>
        </ul>
      </Section>

      <Section n={4} title="Armazenamento de arquivos">
        <p>O Lunari Gallery poderá aplicar:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Limites de armazenamento</li>
          <li>Prazos de retenção</li>
          <li>Regras de expiração de galerias</li>
        </ul>
        <p>conforme o plano contratado.</p>
      </Section>

      <Section n={5} title="Disponibilidade">
        <p>A plataforma poderá passar por:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Atualizações</li>
          <li>Manutenções</li>
          <li>Instabilidades temporárias</li>
        </ul>
      </Section>

      <Section n={6} title="Limitação de responsabilidade">
        <p>O Lunari Gallery não se responsabiliza por:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Perda de arquivos causada por terceiros</li>
          <li>Problemas de conexão do usuário</li>
          <li>Compartilhamento indevido realizado pelo próprio usuário</li>
          <li>Danos indiretos ou lucros cessantes</li>
        </ul>
      </Section>

      <Section n={7} title="Propriedade intelectual">
        <p>A marca, sistema e interface pertencem ao Lunari Gallery.</p>
        <p>As fotografias enviadas permanecem de propriedade do fotógrafo usuário.</p>
      </Section>

      <Section n={8} title="Alterações dos termos">
        <p>Os termos poderão ser alterados periodicamente.</p>
      </Section>

      <Section n={9} title="Legislação aplicável">
        <p>Os presentes termos seguem as leis brasileiras vigentes.</p>
      </Section>
    </LegalPageLayout>
  );
}
