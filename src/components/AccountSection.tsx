// Account info + sign-out button. Server component — the sign-out is a
// <form action={...}> server action, no client JS needed.

type Props = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  signOutAction: () => void | Promise<void>;
};

export default function AccountSection({ user, signOutAction }: Props) {
  const initial = (user.name ?? user.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <section className="tg-card" aria-label="Conta">
      <div className="account-row">
        <div className={`account-avatar${user.image ? "" : " placeholder"}`}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name ?? ""} />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="account-meta">
          {user.name && <strong>{user.name}</strong>}
          {user.email && <p className="tg-help">{user.email}</p>}
        </div>
        <form action={signOutAction}>
          <button type="submit" className="text-button">
            Sair da conta
          </button>
        </form>
      </div>
    </section>
  );
}
