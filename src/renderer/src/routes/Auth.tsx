import { useState, useRef, useEffect } from 'react'

interface Props {
  onAuth: (session: { user_id: string }) => void
}

function parseTokensFromUrl(raw: string): { access_token: string; refresh_token: string } | null {
  try {
    // Accept full URL or just the fragment
    const hash = raw.includes('#') ? raw.split('#')[1] : raw
    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) return { access_token, refresh_token }
    return null
  } catch {
    return null
  }
}

export default function Auth({ onAuth }: Props) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'link'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  async function handleSend() {
    if (!email.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await window.api.db.signInWithMagicLink(email.trim())
      setStep('link')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    if (!token.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      let session: { user_id: string }

      const parsed = parseTokensFromUrl(token.trim())
      if (parsed) {
        // Magic link URL pasted — use setSession directly
        session = await window.api.db.setSession(parsed.access_token, parsed.refresh_token)
      } else if (/^\d{6}$/.test(token.trim())) {
        // 6-digit OTP (if project has OTP mode enabled)
        session = await window.api.db.verifyOtp(email.trim(), token.trim())
      } else {
        setError('Paste the full link from your email, or enter the 6-digit code.')
        setBusy(false)
        return
      }

      await window.api.db.seedDefaultTells()
      onAuth(session)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-paper">
      <div className="w-full max-w-sm px-6">
        <div className="mb-10 text-3xl leading-snug text-ink/90">
          prefrontal cortex
          <br />
          <span className="text-muted">companion</span>
        </div>

        {step === 'email' ? (
          <>
            <p className="mb-6 text-sm text-muted">Enter your email to receive a sign-in link.</p>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="you@example.com"
              className="w-full rounded border border-black/10 bg-white px-4 py-3 text-lg text-ink outline-none placeholder:text-muted/40 focus:border-ink/30"
              disabled={busy}
            />
            <button
              onClick={handleSend}
              disabled={busy || !email.trim()}
              className="mt-4 w-full rounded bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-ink/80 disabled:opacity-30"
            >
              {busy ? 'Sending…' : 'Send link'}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              Check <span className="text-ink">{email}</span> for a sign-in link.
            </p>
            <p className="mb-6 text-xs text-muted/60">
              Copy the full link URL from the email and paste it below.
              <br />
              Wrong email?{' '}
              <button
                className="underline hover:text-ink"
                onClick={() => { setStep('email'); setError(''); setToken('') }}
              >
                Go back
              </button>
            </p>
            <input
              ref={inputRef}
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Paste the link from your email…"
              className="w-full rounded border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/40 focus:border-ink/30"
              disabled={busy}
            />
            <button
              onClick={handleVerify}
              disabled={busy || !token.trim()}
              className="mt-4 w-full rounded bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-ink/80 disabled:opacity-30"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 text-sm text-accent">{error}</p>
        )}
      </div>
    </div>
  )
}
