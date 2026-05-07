import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço — SaveHub",
  description:
    "Termos e condições de uso do aplicativo SaveHub.",
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <article className="legal-prose">
        <p className="eyebrow">SaveHub</p>
        <h1>Termos de Serviço</h1>
        <p className="legal-meta">Última atualização: 28 de abril de 2026</p>

        <p>
          Estes termos regem o uso do aplicativo SaveHub. Ao criar uma conta ou
          usar o serviço, você concorda integralmente com o que está descrito
          aqui. Se não concordar com algum ponto, não use o aplicativo.
        </p>

        <h2>1. O que é o SaveHub</h2>
        <p>
          O SaveHub é um aplicativo pessoal para salvar, organizar e revisitar
          links e referências encontradas em redes sociais, sites e mensageiros.
          Você envia conteúdos manualmente, ou pelos bots opcionais de Telegram
          e WhatsApp, e o SaveHub mantém uma biblioteca privada vinculada à sua
          conta Google.
        </p>

        <h2>2. Conta e elegibilidade</h2>
        <p>
          Para usar o SaveHub você precisa ter pelo menos 13 anos de idade e uma
          conta Google válida. Você é responsável por manter a segurança da sua
          conta Google e por toda atividade realizada por meio dela no SaveHub.
        </p>

        <h2>3. Conteúdo do usuário</h2>
        <p>
          Você é integralmente responsável pelos conteúdos (URLs, descrições,
          mensagens) que envia ao SaveHub. Ao salvar um conteúdo, você declara
          que tem o direito de armazenar aquela referência para uso pessoal.
        </p>
        <p>
          O SaveHub não armazena cópia integral dos conteúdos protegidos por
          direitos autorais — armazena apenas metadados (URL, título,
          descrição, miniatura) e textos curtos que você optar por anotar. A
          responsabilidade pelo respeito aos direitos autorais e termos de uso
          das plataformas de origem é exclusivamente sua.
        </p>

        <h2>4. Uso aceitável</h2>
        <p>Você concorda em <strong>não</strong>:</p>
        <ul>
          <li>
            Usar o SaveHub para armazenar conteúdo ilegal, que viole direitos
            de terceiros, ou que constitua assédio, discurso de ódio ou
            material sexual envolvendo menores;
          </li>
          <li>
            Tentar acessar dados de outros usuários, contornar mecanismos de
            autenticação, ou fazer engenharia reversa do serviço;
          </li>
          <li>
            Sobrecarregar o serviço com requisições automatizadas além do uso
            pessoal razoável;
          </li>
          <li>
            Usar o SaveHub para enviar mensagens não solicitadas (spam) por
            meio dos bots de Telegram ou WhatsApp;
          </li>
          <li>
            Revender, sublicenciar ou comercializar o acesso ao SaveHub.
          </li>
        </ul>
        <p>
          Reservamos o direito de suspender contas que descumpram essas regras.
        </p>

        <h2>5. Integrações com terceiros</h2>
        <p>
          O SaveHub integra-se com Google (autenticação), Telegram (bot
          opcional), WhatsApp Business Cloud API (bot opcional) e Anthropic
          Claude (geração de resumos). Cada uma dessas plataformas tem seus
          próprios termos e políticas de privacidade, que você reconhece estarem
          fora do nosso controle.
        </p>
        <p>
          A vinculação dos bots de Telegram e WhatsApp é opcional e pode ser
          desfeita a qualquer momento dentro do próprio aplicativo.
        </p>

        <h2>6. Disponibilidade e mudanças</h2>
        <p>
          O SaveHub é oferecido &quot;como está&quot;. Podemos fazer manutenção,
          atualizações e mudanças no serviço a qualquer momento. Não garantimos
          disponibilidade ininterrupta nem ausência total de erros.
        </p>
        <p>
          Podemos descontinuar funcionalidades ou o serviço inteiro com aviso
          prévio razoável, oferecendo a você a chance de exportar seus dados.
        </p>

        <h2>7. Privacidade</h2>
        <p>
          O tratamento dos seus dados pessoais segue a{" "}
          <Link href="/privacy">Política de Privacidade</Link>, que faz parte
          integrante destes Termos.
        </p>

        <h2>8. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida por lei, o SaveHub e seus operadores não
          se responsabilizam por danos indiretos, lucros cessantes, perda de
          dados decorrente de falhas em provedores terceiros, ou consequências
          de você ter usado o serviço para finalidades não previstas. Sua
          responsabilidade pelo conteúdo salvo permanece sua.
        </p>

        <h2>9. Encerramento</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento solicitando exclusão
          completa dos seus dados pelos canais de contato. Podemos suspender ou
          encerrar contas que descumpram estes Termos, com aviso quando
          possível.
        </p>

        <h2>10. Lei aplicável</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil.
          Disputas serão resolvidas no foro da comarca de domicílio do usuário,
          conforme garantido pela legislação consumerista.
        </p>

        <h2>11. Contato</h2>
        <p>
          Dúvidas sobre estes Termos:{" "}
          <a href="mailto:mauvichi78@gmail.com">mauvichi78@gmail.com</a>.
        </p>

        <p className="legal-footer">
          <Link href="/privacy">Política de Privacidade</Link> ·{" "}
          <Link href="/login">Entrar</Link>
        </p>
      </article>
    </main>
  );
}
