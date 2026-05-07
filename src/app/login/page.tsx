import { signIn } from "@/auth";

type SearchParams = Promise<{ callbackUrl?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { callbackUrl, error } = await searchParams;

  async function handleGoogleSignIn() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl ?? "/" });
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">S</span>
          <span>SaveHub</span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Bem-vindo</p>
          <h1>Salve referências de qualquer rede em um só lugar.</h1>
          <p className="login-subtitle">
            Entre com sua conta Google pra começar. Suas coleções e conteúdos ficam
            atrelados a esse login.
          </p>
        </div>

        {error && (
          <p className="login-error">
            Não foi possível concluir o login ({error}). Tente novamente.
          </p>
        )}

        <form action={handleGoogleSignIn} className="login-form">
          <button className="primary-button full" type="submit">
            <GoogleGlyph />
            <span>Entrar com Google</span>
          </button>
        </form>

        <p className="login-fineprint">
          Ao entrar, você concorda em deixar o SaveHub guardar links e metadados
          que você escolher salvar.
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <span
      className="icon"
      style={{ width: 22, height: 22 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          d="M21.6 12.227c0-.71-.064-1.394-.184-2.05H12v3.878h5.39a4.605 4.605 0 0 1-2 3.022v2.51h3.235c1.892-1.742 2.985-4.305 2.985-7.36z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 4.965-.895 6.62-2.413l-3.234-2.51c-.896.6-2.043.955-3.386.955-2.605 0-4.81-1.76-5.598-4.124H3.062v2.59A9.996 9.996 0 0 0 12 22z"
          fill="#34A853"
        />
        <path
          d="M6.402 13.908A6.003 6.003 0 0 1 6.085 12c0-.662.114-1.305.317-1.908V7.502H3.062A9.996 9.996 0 0 0 2 12c0 1.614.387 3.14 1.062 4.498l3.34-2.59z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.968c1.47 0 2.787.505 3.825 1.498l2.868-2.867C16.96 3.092 14.696 2 12 2A9.996 9.996 0 0 0 3.062 7.502l3.34 2.59C7.19 7.728 9.396 5.968 12 5.968z"
          fill="#EA4335"
        />
      </svg>
    </span>
  );
}
