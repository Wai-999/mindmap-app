import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain, Keyboard, Share2, Zap } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <Brain className="text-primary size-6" />
          Mindmap
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-16 pb-20 text-center sm:pt-24">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Think out loud. <span className="text-primary">Map it as you go.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-balance">
            A fast, keyboard-first mindmapping canvas with instant autosave and one-click
            sharing — no clutter, just your ideas.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Start mapping for free
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
          <FeatureCard
            icon={<Keyboard className="size-5" />}
            title="Keyboard-first"
            description="Tab to branch, Enter for a new idea, Cmd+Z when you change your mind. Never touch the mouse."
          />
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="Always saved"
            description="Every change autosaves in the background, so you can close the tab and pick up right where you left off."
          />
          <FeatureCard
            icon={<Share2 className="size-5" />}
            title="Share in one click"
            description="Send a link that opens straight into the canvas — view-only or fully editable, no account required."
          />
        </section>
      </main>

      <footer className="text-muted-foreground mx-auto w-full max-w-6xl px-6 py-8 text-center text-sm">
        Built with Next.js, React Flow, and Prisma.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-6">
      <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
