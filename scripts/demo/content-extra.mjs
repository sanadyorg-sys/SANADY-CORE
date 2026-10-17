/**
 * Two more published demo courses (French), loaded by add-demo-courses.mjs.
 * Same shape as content.mjs: `correct` marks the right options of each question.
 */
export const EXTRA_CATEGORIES = ["Didactique des sciences"];

export const EXTRA_COURSES = [
  {
    key: "differenciation",
    title: "Différencier son enseignement",
    category: "Pédagogie et didactique",
    level: "intermediaire",
    minutes: 90,
    audience: "Enseignants du primaire et du secondaire",
    summary: "Adapter les activités aux besoins des élèves sans multiplier la préparation : observer, varier, organiser.",
    description:
      "Cette formation montre comment tenir compte de la diversité des élèves avec des moyens simples : mieux connaître leurs besoins, varier les supports et les démarches, organiser la classe pour que chacun progresse.\n\nChaque module se termine par une évaluation de validation.",
    objectives: [
      "Expliquer ce qu’est la différenciation pédagogique et ce qu’elle n’est pas",
      "Repérer les besoins des élèves à partir d’observations simples",
      "Varier les contenus, les démarches et les productions",
      "Organiser des groupes et des temps de travail autonome",
    ],
    modules: [
      {
        title: "Comprendre la différenciation",
        lessons: [
          {
            title: "Pourquoi différencier ?",
            pages: [
              ["Des élèves tous différents", "Dans une même classe, les élèves n’ont ni les mêmes acquis, ni le même rythme, ni les mêmes façons d’apprendre. Proposer à tous la même tâche, au même moment et de la même manière laisse certains élèves sans défi et d’autres en échec.", "Différencier, c’est organiser l’enseignement pour que chaque élève puisse atteindre les objectifs communs, par des chemins parfois différents."],
              ["Ce que la différenciation n’est pas", "Différencier ne veut pas dire préparer une leçon par élève, ni baisser les exigences pour certains. Les objectifs restent les mêmes pour tous : ce qui varie, ce sont les supports, l’aide apportée, le temps ou la forme du travail.", "Une différenciation réussie reste légère à préparer : quelques variantes bien choisies suffisent souvent."],
            ],
          },
          {
            title: "Observer les besoins des élèves",
            pages: [
              ["Partir d’indices concrets", "Pour différencier, il faut d’abord savoir où en sont les élèves. Une évaluation diagnostique courte en début de séquence, l’observation pendant le travail ou un billet de sortie donnent des indices précis.", "L’objectif n’est pas de classer les élèves, mais de repérer ce qui est acquis, en cours d’acquisition ou à reprendre."],
              ["Des groupes de besoin, pas de niveau", "Les groupes formés à partir de ces indices sont temporaires : ils réunissent des élèves qui ont besoin du même travail à un moment donné, puis changent.", "Des groupes fixes par niveau risquent d’enfermer les élèves dans une étiquette."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Qu’est-ce qui reste commun à tous les élèves dans une classe différenciée ?", options: [["Les objectifs d’apprentissage", true], ["Les supports utilisés", false], ["Le temps accordé à chaque tâche", false]], explanation: "Les objectifs restent communs ; ce sont les chemins pour les atteindre qui varient." },
          { kind: "single", prompt: "Différencier, c’est d’abord…", options: [["Organiser l’enseignement pour que chacun puisse atteindre les objectifs", true], ["Préparer une leçon différente pour chaque élève", false], ["Baisser les exigences pour les élèves en difficulté", false]], explanation: "La différenciation ne multiplie pas les leçons et ne baisse pas les exigences." },
          { kind: "multiple", prompt: "Quels moyens donnent des indices sur les besoins des élèves ?", options: [["Une évaluation diagnostique courte", true], ["L’observation pendant le travail", true], ["Un billet de sortie", true], ["Le classement de l’année précédente", false]], explanation: "Les trois premiers moyens renseignent sur les acquis du moment." },
          { kind: "single", prompt: "Comment former des groupes de besoin ?", options: [["Temporairement, selon le travail dont les élèves ont besoin à un moment donné", true], ["Une fois pour toute l’année, selon le niveau", false], ["Par ordre alphabétique", false]], explanation: "Des groupes temporaires évitent d’enfermer les élèves dans une étiquette." },
        ],
      },
      {
        title: "Différencier en pratique",
        lessons: [
          {
            title: "Varier les contenus, les démarches et les productions",
            pages: [
              ["Trois leviers", "On peut différencier les contenus (textes plus ou moins longs, exemples variés), les démarches (manipuler, schématiser, lire, discuter) et les productions (écrit, oral, schéma, maquette).", "Choisir un seul levier par séance suffit souvent pour commencer."],
              ["Doser l’aide", "Une même tâche peut être proposée avec des aides graduées : un exemple résolu, une liste de mots utiles, une fiche d’indices à demander. L’élève choisit l’aide dont il a besoin, puis apprend à s’en passer.", "L’aide est retirée progressivement, pour viser l’autonomie."],
            ],
          },
          {
            title: "Organiser la classe : groupes et autonomie",
            pages: [
              ["Libérer du temps pour aider", "Pendant que la plupart des élèves travaillent en autonomie sur une tâche claire, l’enseignant peut réunir un petit groupe autour d’une difficulté précise.", "Cela suppose des consignes affichées, des routines connues et une tâche que les élèves peuvent mener seuls."],
              ["Des plans de travail", "Un plan de travail sur quelques jours liste les tâches obligatoires et les tâches au choix. Chaque élève avance à son rythme et coche ce qu’il a terminé.", "Le bilan régulier avec l’enseignant permet d’ajuster la suite."],
            ],
          },
        ],
        questions: [
          { kind: "multiple", prompt: "Quels sont les trois leviers de la différenciation présentés ?", options: [["Les contenus", true], ["Les démarches", true], ["Les productions", true], ["La note finale", false]], explanation: "Contenus, démarches et productions peuvent varier pour un même objectif." },
          { kind: "single", prompt: "Que sont des aides graduées ?", options: [["Des aides de plus en plus précises, que l’élève choisit selon son besoin", true], ["Des points en plus pour les élèves en difficulté", false], ["Des exercices plus faciles notés moins sévèrement", false]], explanation: "L’élève prend l’aide utile, puis apprend à s’en passer." },
          { kind: "single", prompt: "Qu’est-ce qui permet de réunir un petit groupe pendant la séance ?", options: [["Une tâche claire que les autres élèves mènent en autonomie", true], ["Un exercice très long pour occuper la classe", false], ["La suppression des consignes écrites", false]], explanation: "Des consignes affichées et des routines connues rendent l’autonomie possible." },
          { kind: "single", prompt: "À quoi sert un plan de travail ?", options: [["À laisser chaque élève avancer à son rythme sur des tâches définies", true], ["À noter les élèves chaque jour", false], ["À remplacer les explications de l’enseignant", false]], explanation: "Le plan liste les tâches et le bilan régulier ajuste la suite." },
        ],
      },
    ],
  },
  {
    key: "investigation",
    title: "La démarche d’investigation en sciences",
    category: "Didactique des sciences",
    level: "debutant",
    minutes: 90,
    audience: "Enseignants de sciences du primaire et du collège",
    summary: "Faire construire les savoirs scientifiques par les élèves : une question, des hypothèses, une expérience, une conclusion.",
    description:
      "Cette formation présente les étapes de la démarche d’investigation et la façon de la conduire en classe, avec des exemples simples en sciences de la vie et de la Terre et en physique.\n\nChaque module se termine par une évaluation de validation.",
    objectives: [
      "Décrire les étapes de la démarche d’investigation",
      "Faire formuler des hypothèses testables",
      "Concevoir avec les élèves une expérience qui ne change qu’un facteur",
      "Conclure et structurer les savoirs avec la classe",
    ],
    modules: [
      {
        title: "Les étapes de la démarche",
        lessons: [
          {
            title: "Partir d’une question",
            pages: [
              ["Une situation qui intrigue", "La démarche commence par une situation qui pose question aux élèves : une observation surprenante, un phénomène du quotidien, un désaccord entre élèves.", "Exemple : « Pourquoi les plantes posées loin de la fenêtre poussent-elles penchées ? »"],
              ["Une question que l’on peut tester", "La classe transforme la situation en une question précise, à laquelle une observation ou une expérience peut répondre.", "« La lumière a-t-elle une influence sur la direction de la pousse ? » est une question testable ; « Pourquoi les plantes existent-elles ? » ne l’est pas en classe."],
            ],
          },
          {
            title: "Formuler des hypothèses et concevoir une expérience",
            pages: [
              ["Des hypothèses à vérifier", "Une hypothèse est une réponse possible à la question, formulée avant l’expérience. Les élèves peuvent en proposer plusieurs : toutes seront mises à l’épreuve.", "Une hypothèse fausse n’est pas un échec : elle fait avancer la réflexion."],
              ["Ne changer qu’un facteur", "Pour tester une hypothèse, on compare deux situations qui ne diffèrent que par un seul facteur : par exemple deux plantes identiques, l’une éclairée de tous côtés, l’autre d’un seul côté.", "Si plusieurs facteurs changent en même temps, on ne peut pas savoir lequel explique le résultat."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Laquelle de ces questions est testable en classe ?", options: [["La lumière a-t-elle une influence sur la direction de la pousse ?", true], ["Pourquoi les plantes existent-elles ?", false], ["Les plantes sont-elles belles ?", false]], explanation: "Une question testable peut recevoir une réponse par l’observation ou l’expérience." },
          { kind: "single", prompt: "Qu’est-ce qu’une hypothèse ?", options: [["Une réponse possible à la question, formulée avant l’expérience", true], ["Le résultat de l’expérience", false], ["La conclusion écrite par l’enseignant", false]], explanation: "L’hypothèse est mise à l’épreuve par l’expérience." },
          { kind: "single", prompt: "Pourquoi ne changer qu’un seul facteur entre deux situations ?", options: [["Pour savoir quel facteur explique le résultat", true], ["Pour que l’expérience soit plus rapide", false], ["Pour utiliser moins de matériel", false]], explanation: "Si plusieurs facteurs varient, on ne peut pas attribuer le résultat à l’un d’eux." },
          { kind: "multiple", prompt: "Quelles situations peuvent lancer une démarche d’investigation ?", options: [["Une observation surprenante", true], ["Un phénomène du quotidien", true], ["Un désaccord entre élèves", true], ["La lecture de la conclusion dans le manuel", false]], explanation: "La démarche part d’une question que se posent vraiment les élèves." },
        ],
      },
      {
        title: "Conduire la démarche en classe",
        lessons: [
          {
            title: "Expérimenter, observer, mesurer",
            pages: [
              ["Préparer le recueil des résultats", "Avant de commencer, les élèves décident ce qu’ils vont observer ou mesurer, et comment ils vont le noter : tableau, schéma, photo datée.", "Un recueil prévu à l’avance évite de perdre des informations."],
              ["Répéter et comparer", "Un seul essai peut tromper. Répéter l’expérience, ou comparer les résultats de plusieurs groupes, rend la conclusion plus solide.", "Les écarts entre groupes sont une occasion de discuter de la précision des mesures."],
            ],
          },
          {
            title: "Conclure et structurer les savoirs",
            pages: [
              ["Confronter résultats et hypothèses", "Les élèves comparent leurs résultats à leurs hypothèses : lesquelles sont confirmées, lesquelles sont rejetées ? La conclusion répond à la question de départ.", "On distingue ce que l’expérience montre de ce que l’on suppose encore."],
              ["Écrire ce que l’on a appris", "L’enseignant aide la classe à rédiger une trace écrite courte, avec le vocabulaire scientifique juste. Elle relie l’expérience à un savoir général.", "Exemple : « La tige des plantes pousse en direction de la lumière. »"],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Pourquoi prévoir le recueil des résultats avant l’expérience ?", options: [["Pour ne perdre aucune information utile", true], ["Pour connaître le résultat à l’avance", false], ["Pour éviter de faire l’expérience", false]], explanation: "Décider à l’avance quoi noter et comment rend les résultats exploitables." },
          { kind: "single", prompt: "Pourquoi répéter une expérience ?", options: [["Pour rendre la conclusion plus solide", true], ["Pour occuper le temps restant", false], ["Pour obtenir le résultat attendu par l’enseignant", false]], explanation: "Un seul essai peut être trompeur." },
          { kind: "single", prompt: "À quoi doit répondre la conclusion ?", options: [["À la question de départ", true], ["À une nouvelle question choisie par l’enseignant", false], ["À la note de l’évaluation", false]], explanation: "La conclusion confronte les résultats aux hypothèses et répond à la question posée." },
          { kind: "multiple", prompt: "Qu’attend-on d’une bonne trace écrite ?", options: [["Qu’elle soit courte", true], ["Qu’elle utilise le vocabulaire scientifique juste", true], ["Qu’elle relie l’expérience à un savoir général", true], ["Qu’elle recopie tout le déroulé de la séance", false]], explanation: "La trace écrite fixe l’essentiel, avec les mots justes." },
        ],
      },
    ],
  },
];
