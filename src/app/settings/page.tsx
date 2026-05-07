import Link from "next/link";
import TelegramConnect from "@/components/TelegramConnect";
import WhatsappConnect from "@/components/WhatsappConnect";
import { Icon } from "@/components/Icon";
import { getTelegramConnection, getWhatsappConnection } from "@/app/actions";

// Settings hub. Hosts opt-in messaging integrations (WhatsApp, Telegram) —
// kept off the home so users who don't use them aren't nagged by them.
export default async function SettingsPage() {
  const [telegram, whatsapp] = await Promise.all([
    getTelegramConnection(),
    getWhatsappConnection(),
  ]);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? null;
  const waNumber = process.env.WHATSAPP_BUSINESS_NUMBER ?? null;

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <Link
          href="/"
          className="icon-button"
          aria-label="Voltar"
          prefetch={false}
        >
          <Icon name="arrow-left" />
        </Link>
        <div>
          <p className="eyebrow">Conta</p>
          <h1>Configurações</h1>
        </div>
      </header>

      <section aria-label="Integrações">
        <div className="section-heading">
          <h2>Integrações</h2>
        </div>
        <p className="settings-help">
          Caminhos opcionais pra salvar sem abrir o app. WhatsApp é o canal
          principal pro público BR. Telegram fica como alternativa pra quem usa.
        </p>
        <WhatsappConnect
          connected={whatsapp.connected}
          botNumber={waNumber}
        />
        <TelegramConnect
          connected={telegram.connected}
          botUsername={botUsername}
        />
      </section>
    </main>
  );
}
