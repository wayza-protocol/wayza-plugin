// A small Wayza client for the Claude Code mod, over the host's $.http.fetch (a mod has no fetch of its own).
// It follows Wayza's REST API (https://wayza.com/docs/ask/): a settled answer is accepted only when the record names
// the home we trust and answers our own ask, and its Ed25519 signature checks out wherever the host has Ed25519.
import type { HttpInit, HttpResponse } from 'claude-code'

// The host's fetch, `(url, init) => $.http.fetch(url, init)`, made where `$` is in hand.
export type Fetch = (url: string, init?: HttpInit) => Promise<HttpResponse>

export type Person = { to: string; person?: string; decision: string; choice?: string; text?: string; note?: string; as?: string; at?: string }
export type Approval = {
  id: number | string
  title: string
  details?: string
  status: 'waiting' | 'approved' | 'declined' | 'answered' | 'expired' | 'cancelled'
  asked_by?: string
  asked_by_address?: string
  from_ai_with_no_owner?: boolean
  caution?: string
  from_another_home?: boolean
  choices?: string[]
  free_text?: boolean
  request_id?: string
  expires_at?: string
  people?: Person[]
  signed_answer?: Record<string, any>
}
export type Me = {
  you_are: { address: string; name: string; kind: string; owner?: { address: string; name: string } }
  your_person: { address: string; name: string } | null
  claim?: string
}

export class WayzaError extends Error {}

// Paid access stays out of connected AI apps for now, as on the home's MCP server (src/wayza/api/mcp.js): a refusal
// about a price or credits reaches Claude in words that name neither.
export const PRICE_REFUSAL = 'It was not sent: this person doesn\'t take this kind of request through a connected AI app for now.'
export const isPriceError = (code: unknown, message: string) =>
  code === 'price' || /costs [\d.]+ credits|no credits to pay|^Paying credits|^A price to reach/.test(message)

export const canonical = (v: any): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
      : JSON.stringify(v ?? null)

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// The fingerprint of an ask, as the home signs it in the answer record's `request` (CONTRACT.md, step 5).
export const fingerprint = (a: Approval) =>
  sha256Hex(canonical({
    title: a.title,
    details: a.details || null,
    choices: a.choices?.length ? a.choices : null,
    free_text: !!a.free_text,
    asked_by: a.asked_by_address,
    to: (a.people ?? []).map(p => p.to).sort(),
    request_id: a.request_id || null,
    expires_at: a.expires_at || null,
  }))

// Answers a person gave (in the app, or from the email link), as opposed to an AI's.
export const PERSON = new Set(['person', 'email-link'])
const SETTLED = new Set(['approved', 'declined', 'answered', 'expired', 'cancelled'])
export const isSettled = (a: Approval | null | undefined) => !!a && SETTLED.has(a.status)

const b64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const hostOf = (home: string) => new URL(home).host
// Answers are trusted on TLS where Ed25519 is missing, so a home must be https (plain http only on this computer, for testing).
export function safeHome(home: string): string {
  const u = new URL(home)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname))) {
    throw new WayzaError(`The Wayza home must start with https:// (got ${home}).`)
  }
  return home.replace(/\/+$/, '')
}

export class Wayza {
  readonly home: string
  private keys: any[] | null = null

  constructor(private fetch: Fetch, home: string, private key: string) {
    this.home = safeHome(home)
  }

  async call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.fetch(`${this.home}/wayza/v0${path}`, {
      method,
      headers: { authorization: `Bearer ${this.key}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    let data: any = null
    try { data = r.text ? JSON.parse(r.text) : null } catch { /* not JSON */ }
    if (!r.ok) {
      const message = String(data?.error?.message || data?.error || data?.message || `Wayza answered ${r.status}`)
      throw new WayzaError(isPriceError(data?.error?.code ?? data?.code, message) ? PRICE_REFUSAL : message)
    }
    return data as T
  }

  me = () => this.call<Me>('GET', '/me')
  approvals = () => this.call<{ waiting_for_your_person: Approval[]; asked: Approval[] }>('GET', '/approvals')
  ask = (body: Record<string, unknown>) => this.call<Approval>('POST', '/approvals', body)
  // The home holds a waiting request up to `wait` seconds: kept to 20, inside the host fetch's 30-second limit.
  get = (id: Approval['id'], wait = 0) => this.call<Approval>('GET', `/approvals/${encodeURIComponent(String(id))}${wait ? `?wait=${Math.min(20, Math.ceil(wait))}` : ''}`)
  cancel = (id: Approval['id']) => this.call<Approval>('DELETE', `/approvals/${encodeURIComponent(String(id))}`)
  reply = (id: Approval['id'], body: { decision: string; choice?: string; text?: string; note?: string }) =>
    this.call<Approval>('POST', `/approvals/${encodeURIComponent(String(id))}/reply`, body)

  // Checks a settled approval's signed answer: from the home we trust, the answer to `asked` (the approval the home
  // returned when we asked: same id, asker and question fingerprint), and signed with the home's published key.
  // Says how far it got ('signature', or 'tls' where Ed25519 is missing). Throws WayzaError when anything is off.
  async check(settled: Approval, asked: Approval): Promise<'signature' | 'tls'> {
    const signed = settled.signed_answer
    if (!signed) throw new WayzaError('The answer came back without the home\'s signature.')
    const { sig, ...record } = signed
    if (record.v !== 1 || record.type !== 'wayza.answer' || sig?.alg !== 'Ed25519') throw new WayzaError('Not a signed Wayza answer.')
    const url = new URL(record.approval)
    if (record.home !== hostOf(this.home) || url.host !== record.home) throw new WayzaError(`The answer is signed by ${record.home}, not ${hostOf(this.home)}.`)
    if (url.pathname.split('/').pop() !== String(asked.id)) throw new WayzaError('The answer is for a different ask.')
    if (record.asked_by !== asked.asked_by_address || record.request !== await fingerprint(asked)) throw new WayzaError('The answer is for a different question.')
    // Claude Code's mod environment offers only SHA-256 digests, not Ed25519, so the signature itself is checked where
    // the host has Ed25519 and otherwise rests on TLS to the trusted home. The checks above run either way.
    const subtle = crypto.subtle as unknown as { importKey?: (...a: unknown[]) => Promise<unknown>; verify?: (...a: unknown[]) => Promise<boolean> }
    if (typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') return 'tls'
    let entry = (await this.publishedKeys(false)).find(k => k.kid === sig.kid)
    if (!entry) entry = (await this.publishedKeys(true)).find(k => k.kid === sig.kid)
    if (!entry) throw new WayzaError(`Unknown signing key ${sig.kid}.`)
    if (typeof entry.retired === 'string' && record.at && Date.parse(record.at) > Date.parse(entry.retired)) throw new WayzaError('The signing key was retired.')
    const key = await subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: entry.jwk?.x }, { name: 'Ed25519' }, false, ['verify'])
    if (!await subtle.verify({ name: 'Ed25519' }, key, b64(sig.value), new TextEncoder().encode(canonical(record)))) {
      throw new WayzaError('The answer\'s signature does not check out.')
    }
    return 'signature'
  }

  private async publishedKeys(fresh: boolean): Promise<any[]> {
    if (this.keys && !fresh) return this.keys
    const r = await this.fetch(`${this.home}/.well-known/wayza.json`)
    if (!r.ok) throw new WayzaError(`Could not read ${hostOf(this.home)}'s keys (${r.status}).`)
    this.keys = JSON.parse(r.text)?.home?.keys ?? []
    return this.keys!
  }
}

// Signs this Claude Code up as an AI (POST /wayza/v0/agents, which needs no sign-in). With a deploy key from its
// person (wzd_...) it is vouched for by them; without one it is an AI with no owner until its person opens the claim link.
export async function signUp(fetch: Fetch, home: string, name: string, deployKey?: string): Promise<{ key: string; address: string; claim_link: string; tell_your_person?: string }> {
  const r = await fetch(`${safeHome(home)}/wayza/v0/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ name, platform: 'claude-code', ...(deployKey ? { deploy_key: deployKey } : {}) }),
  })
  let out: any = null
  try { out = JSON.parse(r.text) } catch { /* not JSON */ }
  if (!r.ok || !out?.connector_key) throw new WayzaError(out?.error || `Sign-up answered ${r.status}.`)
  return { key: out.connector_key, address: out.full_address || out.address, claim_link: out.claim_link, tell_your_person: out.tell_your_person }
}
