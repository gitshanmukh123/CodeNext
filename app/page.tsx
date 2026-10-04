import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          Just enter your usernames — no signup required
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Understand Your DSA Skills.
          <br />
          <span className="text-primary">Know What to Solve Next.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Analyze your Codeforces and LeetCode journey, discover your blind
          spots, and get a personalized problem roadmap.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <form
            action="/dashboard"
            method="get"
            className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-2 text-left">
              <label
                htmlFor="cf"
                className="text-sm font-medium text-foreground"
              >
                Codeforces username
              </label>
              <input
                type="text"
                id="cf"
                name="codeforces"
                placeholder="e.g. tourist"
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>

            <div className="space-y-2 text-left">
              <label
                htmlFor="lc"
                className="text-sm font-medium text-foreground"
              >
                LeetCode username
              </label>
              <input
                type="text"
                id="lc"
                name="leetcode"
                placeholder="e.g. demo_user"
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Analyze My Profile
            </button>
          </form>

          <Link
            href="/dashboard?demo=true"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Try Demo with sample data
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Strengths & Weaknesses</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Data-driven mastery scores across 50+ DSA concepts.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Blind Spot Detection</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Find important concepts you&apos;ve never practiced.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Personalized Weekly Roadmap</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A Mon–Sun plan built from your actual solving behavior, with your
              progress saved on this device all week.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}