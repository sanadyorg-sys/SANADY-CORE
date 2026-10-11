/**
 * Verified institutional content (source: sanady.org, read on 09/10/2026).
 * See docs/institution/reference-sanady.md for quotes, dates and status.
 * Only facts published by the Foundation belong here: never add figures,
 * partners or values that the Foundation has not confirmed.
 */

export const SANADY_SITE = "https://sanady.org/";

export const FOUNDATION = {
  name: "Fondation Sanady",
  status: "Association marocaine reconnue d’utilité publique",
  since: 2009,
  summary:
    "Elle œuvre depuis 2009 contre l’abandon et l’échec scolaires des élèves des établissements publics issus de milieux socio-économiques défavorisés, ruraux et péri-urbains.",
  mission:
    "Offrir un accompagnement éducatif continu et de qualité aux élèves issus de milieux socio-économiques défavorisés, afin de contribuer à leur réussite scolaire et libérer leur potentiel.",
  vision: "Aucun élève de l’école publique ne devrait abandonner ou échouer à l’école.",
  governance:
    "Le Conseil d’administration réunit les membres fondateurs, des dirigeants d’entreprises affiliées et des membres de la société civile. Il se réunit deux fois par an pour établir le bilan, définir ou ajuster la stratégie, voter le budget et approuver les comptes.",
  organisation:
    "L’équipe de la Fondation associe des membres dédiés à la gestion et des membres exclusivement dédiés au suivi pédagogique et à l’encadrement des programmes éducatifs sur le terrain, aux côtés d’enseignants de l’école publique.",
  email: "contact@sanady.org",
  contactUrl: "https://sanady.org/contact/",
  presentationUrl: "https://sanady.org/presentation/",
  social: [
    { label: "Facebook", href: "https://www.facebook.com/SanadyMaroc/" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC0EdE7X0NO86B3L4n5YLrZg" },
    { label: "X (Twitter)", href: "https://twitter.com/fonda_sanady" },
  ],
} as const;

export interface Program {
  name: string;
  description: string;
  href: string;
  /** The program this platform extends. */
  platform?: boolean;
}

export const PROGRAM_GROUPS: Array<{ key: string; title: string; subtitle: string; programs: Program[] }> = [
  {
    key: "apprentissage",
    title: "Apprentissage",
    subtitle: "Autour de l’apprentissage",
    programs: [
      {
        name: "Soutien scolaire",
        description:
          "Cours de soutien en français et en matières scientifiques, de la 3e année du primaire au baccalauréat, dans les locaux de l’école publique et en petits groupes, avec des évaluations semestrielles.",
        href: "https://sanady.org/le-soutien-scolaire/",
      },
      {
        name: "Formation continue des enseignants",
        description:
          "Moderniser les compétences des enseignants, améliorer la connaissance des processus d’apprentissage des élèves, valoriser la posture de l’enseignant et accompagner les réformes dans le cadre de la Vision 2015-2030.",
        href: "https://sanady.org/la-formation-continue-des-enseignants/",
        platform: true,
      },
    ],
  },
  {
    key: "avenir",
    title: "Avenir",
    subtitle: "Autour de l’avenir",
    programs: [
      {
        name: "Orientation scolaire et professionnelle",
        description:
          "Un dispositif d’orientation dès la 2e année du collège : séances collectives, entretiens individuels et accompagnement dans les choix d’études et de carrière.",
        href: "https://sanady.org/lorientation-scolaire-et-professionnelle/",
      },
      {
        name: "Assistance aux bourses d’études supérieures",
        description:
          "Rapprocher les élèves de milieux défavorisés des meilleures opportunités d’études supérieures : préparation aux concours, assistance aux inscriptions et aux entretiens.",
        href: "https://sanady.org/assistance-aux-bourses/",
      },
    ],
  },
  {
    key: "eveil",
    title: "Éveil",
    subtitle: "Autour de l’éveil",
    programs: [
      {
        name: "Activités parascolaires",
        description:
          "Ateliers, fêtes scolaires, excursions et activités sportives pour ouvrir les horizons des élèves à travers l’art, la culture et le sport.",
        href: "https://sanady.org/activites-parascolaires/",
      },
      {
        name: "Réhabilitation des écoles",
        description:
          "Rénovation des locaux, construction de sanitaires, mise en place de bibliothèques et équipement informatique des écoles d’intervention.",
        href: "https://sanady.org/la-rehabiltation-des-ecoles/",
      },
    ],
  },
];

export interface Publication {
  title: string;
  kind: "Rapport annuel" | "Brochure" | "Fiche partenariat" | "Ressource pédagogique";
  year: string | null;
  description: string;
  href: string;
  format: "PDF" | "Page web";
}

/** Linked, never copied: files stay hosted on sanady.org. */
export const PUBLICATIONS: Publication[] = [
  {
    title: "Rapport annuel 2017-2018",
    kind: "Rapport annuel",
    year: "2017-2018",
    description: "Bilan des activités et des programmes de la Fondation pour l’année scolaire 2017-2018.",
    href: "https://sanady.org/pdf/19-00995-RappAnn_2017-2018_.pdf",
    format: "PDF",
  },
  {
    title: "Rapport annuel 2016-2017",
    kind: "Rapport annuel",
    year: "2016-2017",
    description: "Bilan des activités et des programmes de la Fondation pour l’année scolaire 2016-2017.",
    href: "https://sanady.org/pdf/Rapport%20annuel%202016%202017%20.pdf",
    format: "PDF",
  },
  {
    title: "Brochure institutionnelle",
    kind: "Brochure",
    year: null,
    description: "Présentation de la Fondation Sanady, de sa mission et de ses champs d’intervention.",
    href: "https://sanady.org/pdf/Brochure-institutionnelle1.pdf",
    format: "PDF",
  },
  {
    title: "Soutenir la formation continue des enseignants",
    kind: "Fiche partenariat",
    year: "2018",
    description: "Fiche de présentation du programme de formation continue destinée aux partenaires.",
    href: "https://sanady.org/wp-content/uploads/2018/11/FICHE-3-formation.pdf",
    format: "PDF",
  },
];

export const MALLETTE = {
  title: "Mallette pédagogique de la Fondation Sanady",
  description:
    "Une boîte à outils pédagogiques et didactiques conçue par une équipe pluridisciplinaire de la Fondation : ressources, outils et supports pour le primaire (français, mathématiques) et le collège (français, mathématiques, physique-chimie). La Fondation l’a mise en libre accès.",
  href: "https://sanady.org/mallette-pedagogique/",
};
