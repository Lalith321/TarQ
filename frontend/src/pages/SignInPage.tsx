export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030308] text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-gray-400">Welcome back to TarQ.</p>
        <form className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none ring-0 placeholder:text-gray-500"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none ring-0 placeholder:text-gray-500"
          />
          <button className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-200">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
