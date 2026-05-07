"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveItemAction } from "@/app/actions";

type Props = {
  url: string;
  title?: string;
  collection: string;
};

// Renders a small "Salvando..." card the moment the user lands on /share,
// then fires off the actual save in the background. As soon as the server
// action returns, replaces history with the home URL + flash flag so the
// user sees the toast on their library.
//
// Why client-side and not just `await save() in the server component`:
// fetchUrlMetadata can take 3-5s on slow sites. Doing the save in the server
// component blocks the page render, so the user stares at a white tab while
// Android/Chrome's spinner ticks. Splitting it lets us paint the loading
// shell on the first byte and run the save asynchronously.
export default function ShareSaver({ url, title, collection }: Props) {
  const router = useRouter();
  const calledRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // React Strict Mode invokes effects twice in dev. We must only fire the
    // save once — otherwise we'd save the same item twice on every dev share.
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        await saveItemAction({ url, title, collection });
        router.replace("/?savedFromShare=1");
      } catch (err) {
        console.error("[share] save failed:", err);
        // Keep the user on /share for a moment so they can see what failed,
        // then bounce home with the flash anyway.
        setErrorMessage("Não consegui salvar agora. Voltando pro app...");
        window.setTimeout(() => router.replace("/?shareError=save-failed"), 2000);
      }
    })();
  }, [url, title, collection, router]);

  return (
    <main
      className="settings-shell"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
      }}
    >
      <article className="tg-card" style={{ maxWidth: 480, width: "100%" }}>
        <div className="tg-row" style={{ alignItems: "center", gap: 14 }}>
          <div
            className="tg-icon"
            aria-hidden="true"
            style={{
              background: "linear-gradient(135deg, #0cf2a7, #2563eb)",
              color: "white",
              flexShrink: 0,
            }}
          >
            {/* Inline rotating SVG so we don't need a global @keyframes. */}
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="42 42"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>
          <div className="tg-text" style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>
              Salvando no SaveHub
            </p>
            <strong
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title || url}
            </strong>
            <p className="tg-help" style={{ marginTop: 4 }}>
              Coleção: <em>{collection}</em>
            </p>
            {errorMessage && (
              <p className="login-error" style={{ marginTop: 8 }}>
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
