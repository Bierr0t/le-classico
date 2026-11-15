/**
 * Notifications push de l'app installée. Le téléphone s'abonne auprès d'Apple ou de Google,
 * puis dépose son abonnement dans une boîte aux lettres (un sujet ntfy) que le collecteur relève.
 */
import type { Instantane } from '../core/types.ts';

export type EtatNotifs =
  /** Le push n'est pas configuré côté projet. */
  | 'indisponible'
  /** iPhone ou iPad, dans Safari : il faut d'abord installer l'app sur l'écran d'accueil. */
  | 'installer'
  /** Navigateur sans push. */
  | 'incompatible'
  /** Refusées dans les réglages du téléphone. */
  | 'refusees'
  | 'inactives'
  | 'actives';

const estIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function enregistrerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* pas de push, l'app marche quand même */ });
}

export async function etatNotifs(inst: Instantane): Promise<EtatNotifs> {
  if (!inst.push) return 'indisponible';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return estIOS() && !estInstallee() ? 'installer' : 'incompatible';
  }
  if (Notification.permission === 'denied') return 'refusees';
  try {
    const sw = await navigator.serviceWorker.ready;
    return (await sw.pushManager.getSubscription()) && Notification.permission === 'granted' ? 'actives' : 'inactives';
  } catch { return 'inactives'; }
}

function octets(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(b64);
  const t = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) t[i] = brut.charCodeAt(i);
  return t;
}

async function deposer(sujet: string, message: unknown) {
  const r = await fetch(`https://ntfy.sh/${sujet}`, { method: 'POST', body: JSON.stringify(message) });
  if (!r.ok) throw new Error(`ntfy : HTTP ${r.status}`);
}

/** À appeler depuis un tap : iOS n'affiche la demande d'autorisation que sur un geste. */
export async function activer(inst: Instantane): Promise<EtatNotifs> {
  if (!inst.push) return 'indisponible';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'refusees' : 'inactives';
  const sw = await navigator.serviceWorker.ready;
  const abonnement = (await sw.pushManager.getSubscription())
    ?? (await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(inst.push.clePublique) }));
  await deposer(inst.push.sujet, { type: 'abonner', abonnement: abonnement.toJSON() });
  return 'actives';
}

export async function desactiver(inst: Instantane): Promise<EtatNotifs> {
  const sw = await navigator.serviceWorker.ready;
  const abonnement = await sw.pushManager.getSubscription();
  if (abonnement) {
    await abonnement.unsubscribe();
    if (inst.push) await deposer(inst.push.sujet, { type: 'desabonner', endpoint: abonnement.endpoint }).catch(() => {});
  }
  return 'inactives';
}
