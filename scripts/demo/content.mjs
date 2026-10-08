/**
 * Demo content (French) used by seed-demo.mjs.
 * Lessons are short, genuine pedagogical texts so the demo reads credibly.
 * `correct` marks the right options of each question.
 */
export const CATEGORIES = ["Pédagogie et didactique", "Gestion de classe", "Numérique éducatif"];

export const COURSES = [
  {
    key: "evaluation",
    title: "Évaluation formative en classe",
    category: "Pédagogie et didactique",
    level: "intermediaire",
    minutes: 120,
    audience: "Enseignants du primaire et du secondaire",
    summary: "Utiliser l’évaluation au service des apprentissages : objectifs clairs, vérifications rapides et rétroaction utile.",
    description:
      "Cette formation présente les principes de l’évaluation formative et des pratiques simples, applicables dès demain en classe.\n\nElle alterne apports, exemples concrets et pistes de mise en œuvre. Chaque module se termine par une évaluation de validation.",
    objectives: [
      "Distinguer évaluation formative et évaluation sommative",
      "Formuler des objectifs et des critères de réussite compréhensibles par les élèves",
      "Utiliser des techniques de vérification rapide de la compréhension",
      "Donner une rétroaction qui aide l’élève à progresser",
    ],
    publish: true,
    modules: [
      {
        title: "Comprendre l’évaluation formative",
        lessons: [
          {
            title: "Évaluer pour faire apprendre",
            pages: [
              ["Deux fonctions de l’évaluation", "L’évaluation sommative dresse un bilan à la fin d’une période : elle certifie un niveau atteint. L’évaluation formative intervient pendant l’apprentissage : elle informe l’enseignant et l’élève sur ce qui est acquis et sur ce qui reste à travailler.", "La différence ne tient pas à l’outil mais à l’usage : un même exercice devient formatif lorsque ses résultats servent à ajuster l’enseignement et à guider l’élève."],
              ["Un processus continu", "L’évaluation formative repose sur trois questions : où va l’élève ? où en est-il ? comment l’aider à avancer ? Elle s’inscrit dans le déroulement ordinaire de la séance plutôt que dans des moments isolés.", "Elle suppose un climat de confiance : l’erreur y est considérée comme une information utile, non comme une faute à sanctionner."],
              ["Ce que montre la recherche", "Les travaux de synthèse sur l’évaluation formative montrent des effets positifs sur les apprentissages, en particulier pour les élèves en difficulté, lorsque la rétroaction est précise et suivie d’une possibilité de réessayer.", "À retenir : évaluer souvent, brièvement, et toujours en vue d’une action."],
            ],
          },
          {
            title: "Clarifier les objectifs et les critères de réussite",
            pages: [
              ["Partager l’intention d’apprentissage", "Un élève progresse mieux lorsqu’il sait ce qu’il doit apprendre et pourquoi. L’objectif est formulé en termes de ce que l’élève saura faire, et non en termes d’activité à réaliser.", "Exemple : « Je sais expliquer le rôle des racines » plutôt que « Nous allons faire une fiche sur les plantes »."],
              ["Des critères observables", "Les critères de réussite décrivent ce qui montrera que l’objectif est atteint. Ils sont peu nombreux, concrets et compréhensibles par les élèves.", "Les construire avec la classe, à partir d’exemples de travaux réussis, renforce leur appropriation."],
              ["Utiliser les critères en classe", "Les critères servent de repères pendant le travail, d’appui pour l’autoévaluation et de base commune pour la rétroaction de l’enseignant ou des pairs.", "À retenir : un objectif clair et deux ou trois critères visibles valent mieux qu’une longue grille."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Qu’est-ce qui rend une évaluation « formative » ?", options: [["L’usage de ses résultats pour ajuster l’enseignement et guider l’élève", true], ["Le fait qu’elle ne soit pas notée", false], ["Son placement en fin de trimestre", false]], explanation: "Ce n’est ni l’outil ni l’absence de note qui compte, mais l’usage fait des informations recueillies." },
          { kind: "multiple", prompt: "Parmi ces questions, lesquelles structurent la démarche formative ?", options: [["Où va l’élève ?", true], ["Où en est-il ?", true], ["Comment l’aider à avancer ?", true], ["Quelle note mérite-t-il ?", false]], explanation: "Les trois premières questions décrivent le but, la situation actuelle et l’action à mener." },
          { kind: "single", prompt: "Quelle formulation est un objectif d’apprentissage ?", options: [["Je sais expliquer le rôle des racines", true], ["Nous allons faire une fiche sur les plantes", false], ["Nous regardons une vidéo", false]], explanation: "Un objectif décrit ce que l’élève saura faire, pas l’activité proposée." },
          { kind: "single", prompt: "Combien de critères de réussite est-il conseillé d’afficher ?", options: [["Deux ou trois, concrets et observables", true], ["Le plus possible, pour être exhaustif", false], ["Aucun, pour ne pas influencer les élèves", false]], explanation: "Des critères peu nombreux et lisibles sont plus faciles à utiliser pendant le travail." },
        ],
      },
      {
        title: "Outils et pratiques en classe",
        lessons: [
          {
            title: "Techniques de vérification rapide",
            pages: [
              ["Recueillir des indices de compréhension", "Interroger seulement les élèves qui lèvent la main donne une image trompeuse de la classe. Les techniques de vérification rapide permettent d’obtenir une réponse de tous les élèves en quelques secondes.", "Ardoises, cartes de couleur, réponses à main levée sur un choix multiple, billet de sortie : l’essentiel est de voir les réponses de chacun."],
              ["Le billet de sortie", "En fin de séance, chaque élève répond brièvement à une ou deux questions sur l’objectif du jour. L’enseignant trie rapidement les réponses en trois groupes : acquis, en cours, non acquis.", "Ce tri oriente le début de la séance suivante : reprise ciblée, approfondissement ou groupes de besoin."],
              ["Questionner autrement", "Les questions ouvertes et le temps de réflexion avant la réponse augmentent la participation. Demander « Qui peut expliquer pourquoi ? » est plus informatif que « Avez-vous compris ? ».", "À retenir : vérifier la compréhension de toute la classe, puis décider de la suite."],
            ],
          },
          {
            title: "Donner une rétroaction efficace",
            pages: [
              ["Qu’est-ce qu’une rétroaction utile ?", "Une rétroaction efficace porte sur la tâche et la démarche, pas sur la personne. Elle indique ce qui est réussi, ce qui manque au regard des critères et une piste précise pour progresser.", "Un commentaire comme « Bien » ou « Peut mieux faire » n’aide pas l’élève à savoir quoi faire ensuite."],
              ["Le bon moment", "La rétroaction est plus utile lorsque l’élève peut encore améliorer son travail. Une copie rendue avec une note et un commentaire, sans possibilité de reprise, a un effet limité.", "Prévoir un temps de correction ou de nouvelle tentative transforme le commentaire en levier d’apprentissage."],
              ["Faire participer les élèves", "L’autoévaluation et l’évaluation entre pairs, guidées par les critères de réussite, développent l’autonomie et allègent la charge de l’enseignant.", "À retenir : précise, centrée sur la tâche, suivie d’une action."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Pourquoi éviter de n’interroger que les élèves qui lèvent la main ?", options: [["Cela donne une image trompeuse de la compréhension de la classe", true], ["Cela prend trop de temps", false], ["Cela est interdit par les programmes", false]], explanation: "Les élèves volontaires ne sont pas représentatifs de l’ensemble de la classe." },
          { kind: "multiple", prompt: "Quelles techniques permettent d’obtenir une réponse de tous les élèves ?", options: [["Les ardoises", true], ["Le billet de sortie", true], ["Les cartes de couleur", true], ["Demander « Avez-vous compris ? »", false]], explanation: "Ces outils rendent visibles les réponses de chacun ; la question fermée « Avez-vous compris ? » n’apporte pas d’information fiable." },
          { kind: "single", prompt: "Une rétroaction efficace porte principalement sur…", options: [["La tâche et la démarche de l’élève", true], ["La personnalité de l’élève", false], ["La comparaison avec les autres élèves", false]], explanation: "Elle s’appuie sur les critères de réussite et propose une piste d’amélioration." },
          { kind: "single", prompt: "Quand la rétroaction est-elle la plus utile ?", options: [["Quand l’élève peut encore améliorer son travail", true], ["Uniquement en fin de trimestre", false], ["Après la note définitive", false]], explanation: "Une possibilité de reprise transforme le commentaire en apprentissage." },
        ],
      },
    ],
  },
  {
    key: "gestion",
    title: "Gestion de classe bienveillante",
    category: "Gestion de classe",
    level: "debutant",
    minutes: 90,
    audience: "Enseignants débutants et confirmés",
    summary: "Installer un cadre clair et serein, prévenir les tensions et impliquer les élèves dans la vie de la classe.",
    description: "Une formation pratique pour construire un climat de classe propice aux apprentissages, fondée sur des règles explicites, des routines et une posture bienveillante et ferme.",
    objectives: ["Établir des règles et des routines explicites", "Réussir le démarrage d’une séance", "Désamorcer une situation de tension", "Impliquer les élèves dans le fonctionnement de la classe"],
    publish: true,
    modules: [
      {
        title: "Poser un cadre",
        lessons: [
          {
            title: "Règles et routines",
            pages: [
              ["Peu de règles, bien expliquées", "Un petit nombre de règles formulées positivement est plus efficace qu’une longue liste d’interdits. Chaque règle est expliquée, enseignée et rappelée.", "Exemple : « Je lève la main pour prendre la parole » plutôt que « Il est interdit de crier »."],
              ["Les routines libèrent du temps", "Entrée en classe, distribution du matériel, passage au travail de groupe : des routines enseignées et répétées réduisent les temps morts et les occasions de dispersion.", "Une routine se modélise, se pratique puis se rappelle brièvement."],
              ["Cohérence et constance", "Le cadre rassure lorsqu’il est appliqué de la même façon chaque jour. La cohérence entre collègues d’une même équipe renforce encore son efficacité.", "À retenir : clair, positif, enseigné, constant."],
            ],
          },
          {
            title: "Les premières minutes du cours",
            pages: [
              ["Accueillir", "Se tenir à la porte, saluer les élèves et lancer immédiatement une activité courte installe un climat de travail dès l’entrée.", "L’activité d’accroche est accessible à tous et en lien avec la séance."],
              ["Annoncer le programme", "Afficher l’objectif et les étapes de la séance aide les élèves à se repérer et à s’engager.", "Les élèves savent où ils vont et combien de temps dure chaque étape."],
              ["Anticiper", "Préparer le matériel et le tableau avant l’arrivée des élèves évite les ruptures de rythme qui favorisent l’agitation.", "À retenir : les cinq premières minutes donnent le ton de la séance."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Quelle règle est formulée de manière positive ?", options: [["Je lève la main pour prendre la parole", true], ["Il est interdit de crier", false], ["Pas de bavardage", false]], explanation: "Une règle positive décrit le comportement attendu." },
          { kind: "multiple", prompt: "Quelles caractéristiques rendent une routine efficace ?", options: [["Elle est modélisée", true], ["Elle est pratiquée régulièrement", true], ["Elle change chaque semaine", false]], explanation: "Une routine s’enseigne puis se répète jusqu’à devenir automatique." },
          { kind: "single", prompt: "Pourquoi lancer une activité dès l’entrée en classe ?", options: [["Pour installer immédiatement un climat de travail", true], ["Pour occuper les élèves pendant l’appel uniquement", false], ["Pour remplacer l’objectif de la séance", false]], explanation: "Une accroche accessible engage les élèves dès les premières minutes." },
        ],
      },
      {
        title: "Prévenir et gérer les conflits",
        lessons: [
          {
            title: "Désamorcer une tension",
            pages: [
              ["Garder son calme", "Face à une provocation, une voix posée et un ton neutre évitent l’escalade. Il s’agit de répondre au comportement sans entrer dans un rapport de force public.", "Se rapprocher calmement de l’élève est souvent plus efficace qu’une remarque devant toute la classe."],
              ["Différer l’échange", "Proposer de reprendre la discussion en fin de cours permet à chacun de retrouver son calme et préserve la face de l’élève.", "L’échange individuel est l’occasion de rappeler la règle et de chercher une solution."],
              ["Réparer", "Après un incident, la réparation (excuse, action utile, engagement) est souvent plus éducative qu’une sanction isolée.", "À retenir : calme, discrétion, échange différé, réparation."],
            ],
          },
          {
            title: "Impliquer les élèves",
            pages: [
              ["Des responsabilités partagées", "Confier des rôles (gardien du temps, responsable du matériel, rapporteur) renforce le sentiment d’appartenance et l’autonomie.", "Les rôles tournent pour que chacun puisse y accéder."],
              ["La parole des élèves", "Un temps régulier d’échange sur la vie de la classe permet de prévenir les tensions et de construire des règles comprises par tous.", "L’enseignant garantit le cadre de ces échanges."],
              ["Valoriser les progrès", "Remarquer et nommer les comportements positifs encourage leur répétition plus sûrement que le seul relevé des écarts.", "À retenir : responsabiliser, écouter, valoriser."],
            ],
          },
        ],
        questions: [
          { kind: "single", prompt: "Face à une provocation, quelle attitude évite l’escalade ?", options: [["Répondre calmement et différer l’échange", true], ["Répondre immédiatement devant la classe", false], ["Ignorer définitivement le comportement", false]], explanation: "Le calme et l’échange différé préservent la relation et le cadre." },
          { kind: "multiple", prompt: "Quels moyens impliquent les élèves dans la vie de la classe ?", options: [["Confier des rôles tournants", true], ["Organiser des temps d’échange", true], ["Valoriser les comportements positifs", true], ["Multiplier les sanctions collectives", false]], explanation: "Responsabiliser, écouter et valoriser renforcent l’engagement." },
          { kind: "single", prompt: "Après un incident, qu’est-ce qui est souvent le plus éducatif ?", options: [["Une réparation", true], ["Une sanction sans échange", false], ["L’oubli de l’incident", false]], explanation: "La réparation aide l’élève à comprendre et à agir sur les conséquences." },
        ],
      },
    ],
  },
  {
    key: "numerique",
    title: "Numérique éducatif responsable",
    category: "Numérique éducatif",
    level: "debutant",
    minutes: 60,
    audience: "Tous les enseignants",
    summary: "Brouillon de démonstration : ce cours n’a pas encore d’évaluation et ne peut donc pas être publié.",
    description: "Formation en cours de conception.",
    objectives: ["Identifier les usages pertinents du numérique en classe"],
    publish: false,
    modules: [
      {
        title: "Usages et enjeux",
        lessons: [
          {
            title: "Pourquoi utiliser le numérique ?",
            pages: [["Un outil au service d’un objectif", "Le numérique est pertinent lorsqu’il permet un apprentissage difficile à obtenir autrement : manipuler, simuler, produire, collaborer, différencier.", "La question de départ reste : quel objectif d’apprentissage ?"]],
          },
        ],
        questions: [],
      },
    ],
  },
];
