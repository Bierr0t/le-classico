/**
 * Notifications push de l'app installée, sans serveur.
 *
 *   téléphone ──(abonnement)──► sujet ntfy « …-abonnements » ──► collecteur (toutes les 30 min)
 *   collecteur ──(message chiffré, signé par la clé privée)──► Apple / Google ──► téléphone
 *
 * Le sujet ntfy ne sert que de boîte aux lettres. Un abonnement ne permet à personne d'envoyer
 * quoi que ce soit sans la clé privée (secret VAPID_PRIVATE_KEY). Les abonnements sont gardés
 * chiffrés sur la branche de données, avec une clé dérivée de ce même secret.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as webpush from 'web-push';
import type { Config } from '../src/core/types.ts';

export type Abonnement = { endpoint: string; keys: { p256dh: string; auth: string } };
type Message = { type: 'abonner'; abonnement: Abonnement } | { type: 'desabonner'; endpoint: string };

const MAX_ABONNEMENTS = 20;
/** Seuls les services de push des navigateurs sont acceptés : on n'appelle jamais une adresse arbitraire. */
const SERVICES = ['.push.apple.com', '.googleapis.com', '.push.services.mozilla.com', '.notify.windows.com'];

export const sujetAbonnements = (config: Config) => (config.ntfy ? `${config.ntfy}-abonnements` : null);

export function abonnementValide(a: unknown): a is Abonnement {
  const x = a as Abonnement;
  if (!x || typeof x.endpoint !== 'string' || typeof x.keys?.p256dh !== 'string' || typeof x.keys?.auth !== 'string') return false;
  if (x.endpoint.length > 1000 || x.keys.p256dh.length > 200 || x.keys.auth.length > 100) return false;
  try {
    const u = new URL(x.endpoint);
    return u.protocol === 'https:' && SERVICES.some((s) => u.hostname.endsWith(s));
  } catch { return false; }
}

/** Applique les messages reçus, dans l'ordre. Renvoie la liste à jour et les nouveaux venus. */
export function appliquer(abonnements: Abonnement[], messages: unknown[]): { abonnements: Abonnement[]; nouveaux: Abonnement[] } {
  let liste = [...abonnements];
  const nouveaux: Abonnement[] = [];
  for (const brut of messages) {
    const m = brut as Message;
    if (m?.type === 'abonner' && abonnementValide(m.abonnement)) {
      if (liste.some((a) => a.endpoint === m.abonnement.endpoint) || liste.length >= MAX_ABONNEMENTS) continue;
      const propre = { endpoint: m.abonnement.endpoint, keys: { p256dh: m.abonnement.keys.p256dh, auth: m.abonnement.keys.auth } };
      liste.push(propre);
      nouveaux.push(propre);
    } else if (m?.type === 'desabonner' && typeof m.endpoint === 'string') {
      liste = liste.filter((a) => a.endpoint !== m.endpoint);
    }
  }
  return { abonnements: liste, nouveaux: nouveaux.filter((n) => liste.includes(n)) };
}

const cleDe = (secret: string) => createHash('sha256').update(`abonnements:${secret}`).digest();

export function chiffrer(abonnements: Abonnement[], secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cleDe(secret), iv);
  const donnees = Buffer.concat([c.update(JSON.stringify(abonnements), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), donnees]).toString('base64');
}

export function dechiffrer(texte: string, secret: string): Abonnement[] {
  const b = Buffer.from(texte, 'base64');
  const d = createDecipheriv('aes-256-gcm', cleDe(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
}

/**
 * Relève la boîte aux lettres depuis le dernier message lu. ntfy garde les messages 12 heures :
 * si le repère a expiré, tout est relu, sans conséquence puisqu'un abonnement déjà connu est ignoré.
 */
async function relever(sujet: string, depuis: string | undefined): Promise<{ messages: unknown[]; dernier: string | undefined }> {
  const r = await fetch(`https://ntfy.sh/${sujet}/json?poll=1&since=${encodeURIComponent(depuis || '12h')}`);
  if (!r.ok) throw new Error(`ntfy : HTTP ${r.status}`);
  const messages: unknown[] = [];
  let dernier = depuis;
  for (const ligne of (await r.text()).split('\n')) {
    if (!ligne.trim()) continue;
    try {
      const l = JSON.parse(ligne) as { id?: string; event?: string; message?: string };
      if (l.event !== 'message' || !l.message) continue;
      if (l.id) dernier = l.id;
      messages.push(JSON.parse(l.message));
    } catch { /* ligne illisible : ignorée */ }
  }
  return { messages, dernier };
}

export type Push = {
  /** Envoie une notification à tous les abonnés. Les abonnements expirés sont retirés. */
  envoyer(texte: string, id?: string): Promise<void>;
  /** Enregistre la liste (chiffrée) pour le passage suivant. */
  ranger(): Promise<void>;
  nombre(): number;
};

/**
 * Prépare le push : relève les nouveaux abonnements, salue les nouveaux venus.
 * Renvoie null si le push n'est pas configuré (pas de clé publique ou pas de secret).
 */
export async function preparerPush(config: Config, fichier: string, etat: { pushDepuis?: string }, muet: boolean): Promise<Push | null> {
  const secret = process.env.VAPID_PRIVATE_KEY;
  const sujet = sujetAbonnements(config);
  if (!secret || !config.push?.clePublique || !sujet) return null;
  webpush.setVapidDetails(config.url ?? 'https://github.com', config.push.clePublique, secret);

  let abonnements: Abonnement[] = [];
  try { abonnements = dechiffrer(await readFile(fichier, 'utf8'), secret); } catch { /* premier passage, ou secret changé */ }

  const pousser = async (cibles: Abonnement[], texte: string, id?: string) => {
    const charge = JSON.stringify({ titre: config.nom, corps: texte, url: config.url, id });
    for (const a of cibles) {
      try {
        await webpush.sendNotification(a, charge, { TTL: 86400, urgency: 'normal' });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404 et 410 : l'app a été désinstallée ou les notifications coupées. On oublie l'abonnement.
        if (code === 404 || code === 410) abonnements = abonnements.filter((x) => x.endpoint !== a.endpoint);
        else console.log(`  push en échec (${code ?? (e as Error).message})`);
      }
    }
  };

  try {
    const { messages, dernier } = await relever(sujet, etat.pushDepuis);
    const r = appliquer(abonnements, messages);
    abonnements = r.abonnements;
    etat.pushDepuis = dernier;
    if (r.nouveaux.length && !muet) await pousser(r.nouveaux, 'Notifications activées. Tu sauras tout, tout de suite.', 'bienvenue');
    if (messages.length) console.log(`  push : ${messages.length} message(s) d'abonnement, ${abonnements.length} appareil(s)`);
  } catch (e) {
    console.log(`  push : abonnements non relevés (${(e as Error).message})`);
  }

  return {
    envoyer: (texte, id) => pousser([...abonnements], texte, id),
    ranger: () => writeFile(fichier, chiffrer(abonnements, secret)),
    nombre: () => abonnements.length,
  };
}
