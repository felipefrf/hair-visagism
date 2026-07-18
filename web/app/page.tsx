import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-line">
        <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4 w-full">
          <span className="text-xl font-bold italic">Visagia</span>
          <Link
            href="/analise"
            className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink"
          >
            Começar análise
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <span className="kicker block mb-4">Visagismo digital · MVP</span>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight mb-6">
            O corte certo para o seu rosto — e para{" "}
            <em className="text-secondary">quem você quer ser</em>.
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto mb-10">
            Sua foto é analisada aqui mesmo, no seu navegador: mapeamos as
            proporções do seu rosto, cruzamos com o seu tipo de cabelo e com a
            personalidade que você quer projetar — e explicamos o porquê de
            cada recomendação.
          </p>
          <Link
            href="/analise"
            className="inline-block bg-ink text-white font-mono text-sm px-8 py-3 rounded-lg hover:bg-primary transition-colors"
          >
            Analisar meu rosto
          </Link>
          <p className="font-mono text-xs text-muted mt-6">
            Sua foto não sai do seu aparelho na análise.
          </p>
        </div>
      </section>

      <footer className="border-t border-line py-6">
        <p className="max-w-5xl mx-auto px-6 font-mono text-xs text-muted">
          Visagia — pré-lançamento · análise on-device · LGPD por design
        </p>
      </footer>
    </main>
  );
}
