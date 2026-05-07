import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — SaveHub",
  description:
    "Como o SaveHub coleta, usa e protege dados pessoais dos usuários.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <article className="legal-prose">
        <p className="eyebrow">SaveHub</p>
        <h1>Política de Privacidade</h1>
        <p className="legal-meta">Última atualização: 28 de abril de 2026</p>

        <p>
          Esta política descreve como o SaveHub (&quot;nós&quot;, &quot;serviço&quot;)
          coleta, usa, armazena e compartilha dados pessoais dos usuários
          (&quot;você&quot;) que utilizam o aplicativo. Ao usar o SaveHub, você
          concorda com as práticas descritas aqui.
        </p>

        <h2>1. Dados que coletamos</h2>
        <p>
          O SaveHub coleta apenas os dados necessários pra oferecer o serviço de
          biblioteca pessoal de links salvos:
        </p>
        <ul>
          <li>
            <strong>Identidade do Google</strong>: ao entrar com sua conta
            Google, recebemos seu nome, e-mail e foto de perfil. Não acessamos
            qualquer outro dado da sua conta Google.
          </li>
          <li>
            <strong>Conteúdos que você salva</strong>: URLs, títulos,
            descrições, imagens e tags associados aos links que você envia ao
            SaveHub manualmente, via Telegram ou via WhatsApp.
          </li>
          <li>
            <strong>Identificadores de bot opcionais</strong>: caso você
            conecte seu Telegram ou WhatsApp ao SaveHub, armazenamos o
            identificador da conversa (chat ID do Telegram ou número
            internacional do WhatsApp) somente para vincular as mensagens à sua
            conta.
          </li>
          <li>
            <strong>Dados técnicos mínimos</strong>: registros de erro e logs
            operacionais, mantidos por tempo limitado pra diagnóstico e melhoria
            do serviço. Esses logs não contêm conteúdo pessoal além do
            estritamente necessário.
          </li>
        </ul>
        <p>
          Não coletamos localização, histórico de navegação fora do SaveHub,
          dados de cartão de crédito, ou qualquer informação sensível adicional.
        </p>

        <h2>2. Como usamos os dados</h2>
        <p>Usamos os dados acima exclusivamente para:</p>
        <ul>
          <li>Autenticar você ao entrar no aplicativo;</li>
          <li>
            Salvar, organizar e exibir os conteúdos que você decidiu guardar;
          </li>
          <li>
            Gerar resumos automatizados curtos a partir do título e descrição
            dos links, com auxílio de modelos de inteligência artificial
            (Anthropic Claude); o conteúdo dos links é processado para esse fim
            e não é usado para treinar modelos;
          </li>
          <li>
            Encaminhar mensagens entre o SaveHub e os bots opcionais de
            Telegram e WhatsApp para vincular conteúdos enviados por você nessas
            plataformas;
          </li>
          <li>Diagnosticar problemas e proteger o serviço contra abuso.</li>
        </ul>
        <p>
          Não vendemos, alugamos ou trocamos seus dados com terceiros para fins
          comerciais. Não exibimos publicidade dentro do SaveHub.
        </p>

        <h2>3. Com quem compartilhamos</h2>
        <p>
          Compartilhamos dados apenas com prestadores de serviço estritamente
          necessários para o funcionamento do SaveHub:
        </p>
        <ul>
          <li>
            <strong>Google</strong>, para autenticação OAuth;
          </li>
          <li>
            <strong>Telegram</strong> e <strong>Meta (WhatsApp Business
            Cloud API)</strong>, exclusivamente quando você opta por conectar
            esses canais ao SaveHub;
          </li>
          <li>
            <strong>Anthropic</strong>, para geração de resumos automatizados
            dos itens salvos;
          </li>
          <li>
            Provedor de hospedagem do servidor e do banco de dados.
          </li>
        </ul>
        <p>
          Cada um desses provedores tem sua própria política de privacidade. Ao
          usar o SaveHub você reconhece que parte dos dados pode trafegar por
          essas plataformas para que o serviço funcione.
        </p>

        <h2>4. Onde os dados ficam armazenados</h2>
        <p>
          Os dados são armazenados em banco de dados privado, com acesso restrito
          ao operador do serviço. Usamos boas práticas de segurança razoáveis,
          mas nenhum sistema é 100% imune a falhas — você reconhece esse risco
          ao usar o serviço.
        </p>

        <h2>5. Retenção e exclusão</h2>
        <p>
          Mantemos seus dados enquanto sua conta SaveHub estiver ativa. Você
          pode solicitar a exclusão completa de todos os seus dados a qualquer
          momento entrando em contato pelo e-mail informado abaixo. Após a
          confirmação, removemos sua conta, links salvos, vínculos com Telegram
          e WhatsApp, e tokens de acesso. Cópias residuais em backups são
          eliminadas em até 30 dias.
        </p>

        <h2>6. Seus direitos (LGPD)</h2>
        <p>
          Em conformidade com a Lei Geral de Proteção de Dados (Lei
          13.709/2018), você tem direito a:
        </p>
        <ul>
          <li>Confirmar a existência de tratamento dos seus dados;</li>
          <li>Acessar os dados que mantemos sobre você;</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>Solicitar anonimização, bloqueio ou eliminação;</li>
          <li>Solicitar portabilidade dos seus dados;</li>
          <li>Revogar o consentimento a qualquer momento.</li>
        </ul>
        <p>
          Para exercer qualquer um desses direitos, entre em contato pelos
          canais abaixo.
        </p>

        <h2>7. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas cookies e armazenamento local estritamente necessários
          para autenticação e funcionamento do aplicativo (sessão, preferências
          básicas). Não usamos cookies de rastreamento publicitário nem
          analytics de terceiros.
        </p>

        <h2>8. Crianças</h2>
        <p>
          O SaveHub não é direcionado a menores de 13 anos. Não coletamos
          deliberadamente dados de crianças. Se identificarmos uma conta criada
          por menor de 13 anos, ela será removida.
        </p>

        <h2>9. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política periodicamente. A versão vigente fica
          sempre nesta página, com a data da última atualização indicada no
          topo. Mudanças relevantes serão comunicadas dentro do aplicativo.
        </p>

        <h2>10. Contato</h2>
        <p>
          Para dúvidas, solicitações relacionadas a dados ou exercício de
          direitos: <a href="mailto:mauvichi78@gmail.com">mauvichi78@gmail.com</a>.
        </p>

        <p className="legal-footer">
          <Link href="/terms">Termos de Serviço</Link> ·{" "}
          <Link href="/login">Entrar</Link>
        </p>
      </article>
    </main>
  );
}
