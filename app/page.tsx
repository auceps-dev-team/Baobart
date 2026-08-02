import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardVisual } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { formatCount, formatPrice } from "@/lib/i18n/money";

/**
 * Page de vérification du socle M0.
 *
 * Elle n'a pas vocation à être l'accueil définitif (cf. « Baobart Accueil.dc.html ») :
 * elle prouve que les tokens du Sticker System, les composants et le formatage
 * FCFA sont branchés correctement de bout en bout.
 */

const RESSOURCES = [
  { titre: "Portrait Wax Éditorial", prix: 0, dl: 2340, format: "PSD" },
  { titre: "Illu Femme au Foulard", prix: 5_000, dl: 812, format: "AI" },
  { titre: "Collage Lunettes", prix: 10_000, dl: 156, format: "PNG" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="flex items-center justify-between gap-4 pb-12">
        <div className="flex items-center gap-3">
          <span className="trait grid size-10 place-items-center overflow-hidden rounded-pastille bg-orange">
            <Image
              src="/img/baobab-white.svg"
              alt=""
              width={27}
              height={27}
              className="mt-0.5"
            />
          </span>
          <span className="font-display text-[21px] tracking-[-0.6px]">
            Baobart<span className="text-orange">.</span>
          </span>
        </div>
        <Pill tone="jaune">Socle M0</Pill>
      </header>

      <section className="max-w-3xl">
        <Pill tone="blanc">Le studio partagé de l&apos;Afrique créative</Pill>
        <h1 className="mt-5 font-display text-[clamp(40px,5.4vw,76px)] leading-[0.93] tracking-[-2.5px] uppercase">
          Du premier croquis
          <br />
          au premier encaissement.
        </h1>
        <p className="mt-6 max-w-xl text-[17px]">
          Publie ton travail, fais-le découvrir, vends-le en FCFA. Du vrai
          matériel local, pas de banque d&apos;images générique.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg">Publier un shot</Button>
          <Button size="lg" variant="secondaire">
            Explorer le feed
          </Button>
          <Button size="lg" variant="contraste">
            Voir les tarifs
          </Button>
          <Button size="lg" variant="tertiaire">
            Devenir créateur
          </Button>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-[34px] tracking-[-1px] uppercase">
          Découvre aujourd&apos;hui
        </h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESSOURCES.map((r, i) => (
            <Card
              key={r.titre}
              treatment={i === 0 ? "sticker" : "contour-fin"}
              interactive
            >
              <CardVisual className="rounded-t-[21px]">
                <Pill tone={r.prix === 0 ? "jaune" : "blanc"}>
                  {formatPrice(r.prix)}
                </Pill>
              </CardVisual>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold">{r.titre}</p>
                  <p className="meta mt-1 text-encre/60">
                    {r.format} · {formatCount(r.dl)} dl
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-[34px] tracking-[-1px] uppercase">
          Formats monétaires
        </h2>
        <p className="mt-2 max-w-2xl">
          Tout montant est un entier dans l&apos;unité mineure de sa devise. Le
          FCFA n&apos;ayant pas de décimale, « entiers FCFA » et « unité
          mineure » sont la même chose.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill tone="lavande">{formatPrice(180_000)}</Pill>
          <Pill tone="lavande">{formatPrice(2_500)} / mois</Pill>
          <Pill tone="lavande">{formatPrice(7_500)} / mois</Pill>
          <Pill tone="jaune">{formatPrice(0)}</Pill>
        </div>
      </section>
    </main>
  );
}
