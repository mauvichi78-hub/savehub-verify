"use client";

import { useState, useTransition } from "react";
import {
  createTelegramLinkToken,
  disconnectTelegram,
} from "@/app/actions";

type Props = {
  connected: boolean;
  botUsername: string | null;
};

export default function TelegramConnect({ connected, botUsername }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await createTelegramLinkToken();
        setToken(r.token);
        setExpiresAt(new Date(r.expiresAt));
      } catch (e) {
        console.error(e);
        setError("Erro ao gerar código. Tente de novo.");
      }
    });
  }

  function disconnect() {
    if (!confirm("Desconectar Telegram do SaveHub?")) return;
    startTransition(async () => {
      await disconnectTelegram();
      setToken(null);
      setExpiresAt(null);
    });
  }

  // Connected state — small confirmation card with disconnect option.
  if (connected) {
    return (
      <section className="tg-card tg-card-connected" aria-label="Telegram">
        <div className="tg-row">
          <div className="tg-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="tg-text">
            <p className="eyebrow" style={{ marginBottom: 4 }}>Telegram</p>
            <strong>Conectado</strong>
            <p className="tg-help">
              Encaminhe links pra <a href={botUsername ? `https://t.me/${botUsername}` : "#"} target="_blank" rel="noreferrer">@{botUsername ?? "savehub_bot"}</a> que eles caem aqui.
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

  // Disconnected state — generate code + show instructions.
  const deepLink =
    botUsername && token
      ? `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`
      : null;

  return (
    <section className="tg-card" aria-label="Conectar Telegram">
      <div className="tg-row">
        <div className="tg-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path
              d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="tg-text">
          <p className="eyebrow" style={{ marginBottom: 4 }}>Telegram</p>
          <strong>Conecte pra salvar encaminhando do app</strong>
          <p className="tg-help">
            Funciona no iPhone, Android e desktop. Vincula uma vez, depois
            é só encaminhar conteúdo pro bot.
          </p>
        </div>

        {!token && (
          <button
            className="primary-button"
            type="button"
            onClick={generate}
            disabled={pending || !botUsername}
            title={!botUsername ? "Bot ainda não configurado (env)" : undefined}
          >
            {pending ? "Gerando..." : "Conectar Telegram"}
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
                    abrir @{botUsername} no Telegram
                  </a>{" "}
                  (ou procura o bot manualmente).
                </>
              ) : (
                <>Abra o Telegram e busque por <strong>@{botUsername}</strong>.</>
              )}
            </li>
            <li>
              Mande este comando pra ele:
              <code className="tg-code">/start {token}</code>
            </li>
            <li>O bot vai responder confirmando o vínculo. Depois recarregue esta página.</li>
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
