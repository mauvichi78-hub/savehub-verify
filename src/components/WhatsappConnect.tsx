"use client";

import { useState, useTransition } from "react";
import {
  createWhatsappLinkToken,
  disconnectWhatsapp,
} from "@/app/actions";

type Props = {
  connected: boolean;
  // The bot's business number (international format, no `+`), e.g. "5511...".
  // Set in env as WHATSAPP_BUSINESS_NUMBER.
  botNumber: string | null;
};

// WhatsApp deep link that opens the chat with the bot and pre-fills the
// `/start <code>` text — user just hits Send.
function buildDeepLink(number: string, token: string): string {
  const text = encodeURIComponent(`/start ${token}`);
  return `https://wa.me/${number}?text=${text}`;
}

export default function WhatsappConnect({ connected, botNumber }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await createWhatsappLinkToken();
        setToken(r.token);
        setExpiresAt(new Date(r.expiresAt));
      } catch (e) {
        console.error(e);
        setError("Erro ao gerar código. Tente de novo.");
      }
    });
  }

  function disconnect() {
    if (!confirm("Desconectar WhatsApp do SaveHub?")) return;
    startTransition(async () => {
      await disconnectWhatsapp();
      setToken(null);
      setExpiresAt(null);
    });
  }

  if (connected) {
    return (
      <section className="tg-card tg-card-connected" aria-label="WhatsApp">
        <div className="tg-row">
          <div
            className="tg-icon"
            aria-hidden="true"
            style={{ background: "#25d366" }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M20 12.1c0 4.4-3.6 8-8 8a8 8 0 0 1-3.9-1L4 20.4l1.4-4A7.9 7.9 0 0 1 4 12.1c0-4.4 3.6-8 8-8s8 3.6 8 8zm-3.5 2.6c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.6.7c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.3.1-.4l.4-.4c.1-.2.2-.3.3-.5l-.1-.4-.6-1.5c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.4 4 3.4 1.7.7 2 .6 2.4.5.4 0 1.2-.5 1.4-1 .1-.4.1-.8.1-.9-.1-.1-.2-.2-.5-.3z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="tg-text">
            <p className="eyebrow" style={{ marginBottom: 4 }}>WhatsApp</p>
            <strong>Conectado</strong>
            <p className="tg-help">
              Encaminhe links pro número do SaveHub que eles caem aqui.
            </p>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={disconnect}
            disabled={pending}
          >
            Desconectar
          </button>
        </div>
      </section>
    );
  }

  const deepLink =
    botNumber && token ? buildDeepLink(botNumber, token) : null;

  return (
    <section className="tg-card" aria-label="Conectar WhatsApp">
      <div className="tg-row">
        <div
          className="tg-icon"
          aria-hidden="true"
          style={{ background: "#25d366" }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M20 12.1c0 4.4-3.6 8-8 8a8 8 0 0 1-3.9-1L4 20.4l1.4-4A7.9 7.9 0 0 1 4 12.1c0-4.4 3.6-8 8-8s8 3.6 8 8zm-3.5 2.6c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.6.7c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.3.1-.4l.4-.4c.1-.2.2-.3.3-.5l-.1-.4-.6-1.5c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.4 4 3.4 1.7.7 2 .6 2.4.5.4 0 1.2-.5 1.4-1 .1-.4.1-.8.1-.9-.1-.1-.2-.2-.5-.3z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="tg-text">
          <p className="eyebrow" style={{ marginBottom: 4 }}>WhatsApp</p>
          <strong>Conecte e salve encaminhando do app</strong>
          <p className="tg-help">
            Funciona em qualquer celular. Vincula uma vez, depois é só
            encaminhar conteúdo pro número do SaveHub.
          </p>
        </div>

        {!token && (
          <button
            className="primary-button"
            type="button"
            onClick={generate}
            disabled={pending || !botNumber}
            title={!botNumber ? "Número do bot ainda não configurado (env)" : undefined}
          >
            {pending ? "Gerando..." : "Conectar WhatsApp"}
          </button>
        )}
      </div>

      {error && <p className="login-error" style={{ marginTop: 12 }}>{error}</p>}

      {token && (
        <div className="tg-instructions">
          <ol>
            <li>
              {deepLink ? (
                <>
                  Toca em{" "}
                  <a className="tg-deeplink" href={deepLink} target="_blank" rel="noreferrer">
                    abrir o SaveHub no WhatsApp
                  </a>{" "}
                  (ou salva o número {botNumber} e manda mensagem).
                </>
              ) : (
                <>Abra o WhatsApp e mande mensagem pro número do SaveHub.</>
              )}
            </li>
            <li>
              O texto já vem pronto:
              <code className="tg-code">/start {token}</code>
            </li>
            <li>O bot responde confirmando o vínculo. Recarregue esta página depois.</li>
          </ol>
          {expiresAt && (
            <p className="tg-help">
              Código válido por ~10 min ({expiresAt.toLocaleTimeString("pt-BR")}).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
