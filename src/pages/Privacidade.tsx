import { LegalPageLayout, Section } from '@/components/legal/LegalPageLayout';

export default function Privacidade() {
  return (
    <LegalPageLayout
      title="Política de Privacidade — Lunari Gallery"
      description="Como o Lunari Gallery coleta, utiliza e protege informações de fotógrafos usuários e seus clientes finais."
      canonical="https://gallery.lunarihub.com/privacidade"
      updatedAt="18 de maio de 2026"
    >
      <Section n={1} title="Introdução">
        <p>
          A presente Política de Privacidade descreve como o aplicativo Lunari Gallery coleta, utiliza
          e protege informações relacionadas aos fotógrafos usuários e seus clientes finais.
        </p>
      </Section>

      <Section n={2} title="Dados coletados">
        <p>O Lunari Gallery poderá coletar:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Nome e e-mail do fotógrafo</li>
          <li>Dados de clientes finais</li>
          <li>Fotografias enviadas para galerias</li>
          <li>Informações de seleção e aprovação</li>
          <li>Dados de acesso e navegação</li>
          <li>Informações técnicas do dispositivo</li>
        </ul>
      </Section>

      <Section n={3} title="Finalidade dos dados">
        <p>Os dados são utilizados para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Disponibilizar galerias online</li>
          <li>Permitir seleção e aprovação de fotos</li>
          <li>Realizar entregas digitais</li>
          <li>Melhorar desempenho da plataforma</li>
          <li>Garantir segurança operacional</li>
        </ul>
      </Section>

      <Section n={4} title="Responsabilidade sobre conteúdo">
        <p>O fotógrafo usuário é integralmente responsável:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Pelas imagens enviadas</li>
          <li>Pela autorização de uso das fotografias</li>
          <li>Pelo tratamento de dados de clientes finais</li>
        </ul>
        <p>O Lunari Gallery atua apenas como plataforma tecnológica.</p>
      </Section>

      <Section n={5} title="Compartilhamento">
        <p>Os dados poderão ser compartilhados apenas:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Com serviços essenciais de infraestrutura</li>
          <li>Com provedores de armazenamento e CDN</li>
          <li>Em casos exigidos por lei</li>
        </ul>
      </Section>

      <Section n={6} title="Segurança">
        <p>
          A plataforma adota medidas razoáveis de segurança para proteção dos dados e arquivos armazenados.
        </p>
      </Section>

      <Section n={7} title="Direitos dos titulares">
        <p>Usuários e clientes poderão solicitar:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Correção de dados</li>
          <li>Exclusão de informações</li>
          <li>Revogação de consentimento</li>
          <li>Acesso aos dados pessoais</li>
        </ul>
      </Section>

      <Section n={8} title="Alterações desta política">
        <p>A política poderá ser atualizada periodicamente.</p>
      </Section>

      <Section n={9} title="Contato">
        <p>
          E-mail:{' '}
          <a href="mailto:contato@lunarihub.app" className="text-primary hover:underline">
            contato@lunarihub.app
          </a>
        </p>
      </Section>
    </LegalPageLayout>
  );
}
