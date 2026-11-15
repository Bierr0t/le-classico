/** L'affiche du moment : une image verticale dessinée sur canvas, envoyée par le partage du téléphone. */
import type { Duel, Instantane, Joueur } from '../core/types.ts';

const L = 1080;
const H = 1350;
const NUIT = '#0f0e13';
const PAPIER = '#f6efe0';
const OR = '#f2c230';
const SOURD = '#a39f93';

function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const resultat: string[] = [];
  let ligne = '';
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > largeur && ligne) { resultat.push(ligne); ligne = mot; }
    else ligne = essai;
  }
  if (ligne) resultat.push(ligne);
  return resultat;
}

export async function dessinerAffiche(inst: Instantane, duel: Duel, a: Joueur, b: Joueur): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const titre = (px: number) => `${px}px Anton, Impact, sans-serif`;
  const texte = (px: number, gras = 500) => `${gras} ${px}px "Archivo Variable", system-ui, sans-serif`;

  ctx.fillStyle = NUIT;
  ctx.fillRect(0, 0, L, H);
  // Les deux coins du ring : une diagonale de couleur de chaque côté.
  for (const [couleur, x0, x1] of [[a.couleur, 0, 400], [b.couleur, L, L - 400]] as const) {
    ctx.fillStyle = couleur;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineTo(x0, 760); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = OR;
  ctx.font = titre(64);
  ctx.fillText(inst.nom.toUpperCase(), L / 2, 120);

  ctx.font = titre(104);
  ctx.fillStyle = a.couleur;
  ctx.fillText(a.nom.toUpperCase(), L * 0.25, 300);
  ctx.fillStyle = b.couleur;
  ctx.fillText(b.nom.toUpperCase(), L * 0.75, 300);
  ctx.fillStyle = SOURD;
  ctx.font = titre(48);
  ctx.fillText('VS', L / 2, 290);

  ctx.font = titre(330);
  ctx.fillStyle = a.couleur;
  ctx.fillText(String(duel.score[a.cle]), L * 0.25, 640);
  ctx.fillStyle = b.couleur;
  ctx.fillText(String(duel.score[b.cle]), L * 0.75, 640);
  ctx.fillStyle = PAPIER;
  ctx.fillText(':', L / 2, 610);
  ctx.fillStyle = SOURD;
  ctx.font = texte(30);
  ctx.fillText('points de ceintures', L / 2, 700);

  ctx.fillStyle = PAPIER;
  ctx.font = texte(46, 700);
  let y = 800;
  for (const l of lignes(ctx, duel.accroche, L - 160).slice(0, 3)) { ctx.fillText(l, L / 2, y); y += 58; }

  // Les ceintures : une pastille par ceinture, de la couleur de son tenant.
  y = Math.max(y + 30, 990);
  const tenues = duel.ceintures.filter((c) => c.tenant).slice(0, 8);
  ctx.font = texte(30, 600);
  const colonnes = 2;
  const largeurCol = (L - 160) / colonnes;
  tenues.forEach((c, i) => {
    const x = 80 + (i % colonnes) * largeurCol;
    const yy = y + Math.floor(i / colonnes) * 56;
    ctx.fillStyle = c.tenant === a.cle ? a.couleur : b.couleur;
    ctx.beginPath();
    ctx.arc(x + 12, yy - 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAPIER;
    ctx.textAlign = 'left';
    let nom = c.nom;
    while (ctx.measureText(nom).width > largeurCol - 60 && nom.length > 4) nom = `${nom.slice(0, -2).trimEnd()}…`;
    ctx.fillText(nom, x + 38, yy);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = SOURD;
  ctx.font = texte(28);
  const pied = (inst.url ?? location.href.split('#')[0]).replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.fillText(pied, L / 2, H - 50);

  return new Promise((resolve, reject) => canvas.toBlob((b2) => (b2 ? resolve(b2) : reject(new Error('canvas'))), 'image/png'));
}

export async function partagerAffiche(inst: Instantane, duel: Duel, a: Joueur, b: Joueur): Promise<'partage' | 'telecharge' | 'echec'> {
  try {
    const blob = await dessinerAffiche(inst, duel, a, b);
    const fichier = new File([blob], 'le-classico.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], text: duel.accroche });
      return 'partage';
    }
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = fichier.name;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 5000);
    return 'telecharge';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'partage' : 'echec';
  }
}
