/**
 * Demo video lessons (French): short narrated introductions, one per demo
 * course. Used by add-demo-videos.mjs. Each slide is spoken as written in
 * `say`; `bullets` are what appears on screen.
 */
export const VIDEOS = [
  {
    course: "Évaluation formative en classe",
    title: "Introduction : évaluer pour faire progresser",
    description: "Vidéo d’introduction (2 minutes) : les idées clés de la formation, avant de commencer les leçons.",
    slides: [
      {
        kind: "title",
        heading: "Évaluer pour faire progresser",
        sub: "Évaluation formative en classe · Introduction",
        say: "Bienvenue dans cette formation consacrée à l’évaluation formative. En deux minutes, découvrons pourquoi évaluer pendant l’apprentissage aide chaque élève à progresser.",
      },
      {
        heading: "Formative ou sommative ?",
        bullets: ["Sommative : un bilan en fin de période", "Formative : une information pendant l’apprentissage", "Ce qui compte : l’usage des résultats"],
        say: "L’évaluation sommative dresse un bilan, à la fin d’une période. L’évaluation formative, elle, intervient pendant l’apprentissage. La différence ne tient pas à l’outil, mais à l’usage : un exercice devient formatif lorsque ses résultats servent à ajuster l’enseignement.",
      },
      {
        heading: "Trois questions pour guider l’élève",
        bullets: ["Où va l’élève ?", "Où en est-il ?", "Comment l’aider à avancer ?"],
        say: "La démarche formative repose sur trois questions simples. Où va l’élève ? Où en est-il aujourd’hui ? Et comment l’aider à avancer ? Dans ce climat, l’erreur devient une information utile, et non une faute.",
      },
      {
        heading: "Dès demain en classe",
        bullets: ["Afficher l’objectif et deux ou trois critères de réussite", "Recueillir la réponse de tous les élèves", "Donner une rétroaction, puis permettre un nouvel essai"],
        say: "Dès demain, vous pouvez afficher l’objectif de la séance avec deux ou trois critères de réussite, recueillir la réponse de tous les élèves grâce à des ardoises ou des cartes, et donner une rétroaction précise, suivie d’un nouvel essai.",
      },
      {
        kind: "end",
        heading: "À vous de jouer",
        sub: "Lisez la première leçon, puis validez le module avec l’évaluation.",
        say: "À vous de jouer ! Lisez maintenant la première leçon, puis validez le module avec son évaluation. Bonne formation.",
      },
    ],
  },
  {
    course: "Gestion de classe bienveillante",
    title: "Introduction : un cadre clair, un climat serein",
    description: "Vidéo d’introduction (2 minutes) : pourquoi un cadre clair et des routines rendent la classe plus sereine.",
    slides: [
      {
        kind: "title",
        heading: "Un cadre clair, un climat serein",
        sub: "Gestion de classe bienveillante · Introduction",
        say: "Bienvenue dans cette formation sur la gestion de classe bienveillante. Voyons ensemble comment un cadre clair permet à chacun d’apprendre dans la sérénité.",
      },
      {
        heading: "Pourquoi un cadre ?",
        bullets: ["Il sécurise les élèves", "Il rend les attentes prévisibles", "Il libère du temps pour apprendre"],
        say: "Un cadre clair sécurise les élèves. Lorsque les attentes sont prévisibles, la classe perd moins de temps, et ce temps est rendu aux apprentissages.",
      },
      {
        heading: "Règles et routines",
        bullets: ["Peu de règles, formulées positivement", "Des routines enseignées et répétées", "Les mêmes attentes pour tous"],
        say: "Mieux vaut peu de règles, formulées de manière positive. Les routines, comme l’entrée en classe ou la distribution du matériel, s’enseignent et se répètent. Et les attentes sont les mêmes pour tous les élèves.",
      },
      {
        heading: "Quand une tension apparaît",
        bullets: ["Rester calme et parler doucement", "Intervenir en privé plutôt qu’en public", "Revenir sur l’incident plus tard, à froid"],
        say: "Lorsqu’une tension apparaît, restez calme et parlez doucement. Intervenez en privé plutôt que devant toute la classe, et revenez sur l’incident plus tard, à froid, avec l’élève.",
      },
      {
        kind: "end",
        heading: "À vous de jouer",
        sub: "Commencez par la leçon « Règles et routines ».",
        say: "À vous de jouer ! Commencez par la leçon consacrée aux règles et aux routines. Bonne formation.",
      },
    ],
  },
  {
    course: "Numérique éducatif responsable",
    title: "Introduction : le numérique au service des apprentissages",
    description: "Vidéo d’introduction (1 minute) : partir de l’objectif pédagogique et utiliser le numérique de façon responsable.",
    slides: [
      {
        kind: "title",
        heading: "Le numérique au service des apprentissages",
        sub: "Numérique éducatif responsable · Introduction",
        say: "Bienvenue dans cette formation sur le numérique éducatif responsable.",
      },
      {
        heading: "Partir de l’objectif",
        bullets: ["D’abord l’intention pédagogique", "Ensuite l’outil le plus simple", "Le numérique n’est pas une fin en soi"],
        say: "Tout commence par l’intention pédagogique. Ensuite seulement, on choisit l’outil le plus simple pour l’atteindre. Le numérique n’est pas une fin en soi.",
      },
      {
        heading: "Un usage responsable",
        bullets: ["Protéger les données des élèves", "Vérifier les sources", "Éviter le temps d’écran inutile"],
        say: "Un usage responsable, c’est protéger les données personnelles des élèves, vérifier les sources avec eux, et éviter le temps d’écran inutile.",
      },
      {
        kind: "end",
        heading: "À vous de jouer",
        sub: "Poursuivez avec la leçon « Pourquoi utiliser le numérique ? ».",
        say: "Poursuivez maintenant avec la première leçon. Bonne formation.",
      },
    ],
  },
];
