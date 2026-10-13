# Guide de l’équipe — SANADY Enterprise

Pour l’équipe de la Fondation Sanady qui reçoit les demandes des entreprises et prépare les propositions.

> **Activité proposée.** La formation des entreprises n’est pas encore un programme officiel de la Fondation. La page publique reste cachée (pas de lien dans le menu, pas sur Google) et parle de « services en projet ». Aucune proposition ne doit être envoyée avant les validations de la Fondation (statuts, fiscalité, gouvernance — voir `plan.md` §1).

## 1. Qui fait quoi

| Rôle | Ce que la personne peut faire |
|---|---|
| **Responsable entreprises** | Traiter les demandes, créer les fiches client, faire avancer le suivi, préparer et envoyer les propositions, ajouter notes et tâches. |
| **Responsable de production** | Consulter les demandes, clients et propositions, ajouter des notes. (La production des formations viendra plus tard.) |
| **Approbateur habilité** | **Approuver une proposition** et marquer **« Contrat signé »**. Ce sont les mêmes approbateurs que pour les partenariats. |
| **Administrateur SANADY** | Attribue les rôles et désigne les approbateurs (jamais lui-même). Être administrateur ne donne **pas** le pouvoir d’approuver. |

Les rôles se gèrent dans **Administration → Équipe SANADY**. Tout le monde se connecte avec la **double authentification**.

## 2. Recevoir une demande

1. Une entreprise remplit le formulaire de la page **Partenariats → Entreprises** (6 étapes : organisation, contact, service, besoins, documents PDF, envoi). Elle reçoit une **référence** (ex. `ENT-2026-0001`).
2. La demande arrive dans **Entreprises → Demandes**. Ouvrez-la : informations, besoin, documents (bouton **Télécharger**, lien valable une minute).
3. Décidez : **Qualifier**, **Ne pas retenir**, **Retirée** ou **Indésirable**.
4. Pour donner suite, **créez la fiche client**. Si l’organisation existe déjà (par exemple comme partenaire), choisissez-la dans la liste : la même fiche porte alors les deux relations, sans doublon.

## 3. Suivre un client

Étapes : Prospect → Qualifié → Réunion de découverte → Analyse des besoins → Proposition → Négociation → **Validation institutionnelle** → **Contrat signé** → Mise en place → Service actif → Renouvellement. Une fiche peut aussi être « Perdu » ou « Retiré ».

- Seul un **approbateur habilité** peut passer de « Validation institutionnelle » à « Contrat signé ».
- Après la signature, les premières étapes sont fermées.
- Notes internes et tâches de suivi (avec échéance et responsable) sur chaque fiche.

## 4. Préparer une proposition

1. Sur la fiche client, **Nouvelle proposition** (référence `PROP-2026-0001`).
2. Ajoutez des **lignes** : catégorie (analyse des besoins, conception, vidéos, accès plateforme…), libellé, quantité, prix unitaire. Il n’y a aucun prix fixé à l’avance : chaque ligne est saisie.
3. **Soumettre en revue interne**, puis un **approbateur** approuve (il faut au moins une ligne). Les lignes sont alors verrouillées ; modifier la proposition la renvoie en brouillon et demande une nouvelle approbation.
4. Le responsable **envoie** la proposition, puis indique la réponse : **Acceptée**, **Refusée** ou **Expirée**.

Chaque changement est inscrit dans l’historique avec le nom de la personne.

## 5. Espaces de formation des entreprises

Un **espace de formation** est l’espace sécurisé d’un client : ses collaborateurs, les formations ouvertes pour lui, ses rapports. Une entreprise ne voit jamais les données d’une autre, ni les enseignants de SANADY.

**Mise en place (10 étapes, vérifiées automatiquement)** — menu **Espaces de formation** :

1. Le contrat du client est signé (étape « Contrat signé », par un approbateur).
2. Sur la fiche client, **Préparer l’espace de formation** : nom, adresse (`/entreprise/…`), formule, nombre de collaborateurs autorisés, stockage, dates du contrat, document de fin (attestation ou certificat).
3. Un **approbateur** autorise la création (ou la refuse).
4. **Générer l’espace**, puis inviter l’**administrateur de l’entreprise** (si l’envoi d’e-mails n’est pas configuré, un lien s’affiche : transmettez-le de façon sûre).
5. L’équipe pédagogique **ouvre au moins une formation** à l’espace (Formations → Autorisations). Une formation propre à l’entreprise peut y être marquée « réservée à l’espace de cette entreprise ».
6. Un **administrateur SANADY** confirme les contrôles de sécurité.
7. **Activer l’espace** : refusé tant qu’une étape manque.

**Ensuite**, l’administrateur de l’entreprise invite ses collaborateurs (un par un ou par liste/CSV), crée des **services**, affecte les formations et suit la progression. La limite de collaborateurs du contrat est appliquée automatiquement (invitations en attente comprises).

**Fin de contrat** : « Enregistrer la fin du contrat » (motif obligatoire) → plus aucune nouvelle invitation → un approbateur **autorise l’export** → fixez la **date de suppression** des données → **Fermer l’espace** (accès retirés). Rien n’est supprimé immédiatement.

## 6. Studio de production (formations sur mesure)

Menu **Studio de production**. Un projet se crée depuis la fiche du client (**Nouveau projet**).

1. **Besoins** : public, objectifs, contraintes, langue, durée, propriété du contenu, espace du client, revue du client prévue ou non.
2. **Conception** : ajoutez les modules du **programme**, puis **Créer la formation à partir du programme** (brouillon réservé au client).
3. **Production** : ajoutez les **formateurs** (ils écrivent la formation dans l’éditeur habituel : vidéos, PDF, évaluations) et les **tâches** (vidéo, PDF, évaluation…). Chacun termine ses tâches depuis le Studio.
4. **Revue pédagogique** : « Soumettre à la revue pédagogique » (toutes les tâches terminées, formation complète) ; un responsable pédagogique valide ou demande des modifications.
5. **Revue du client** (si prévue) : l’administrateur de l’entreprise valide le programme dans « Formations sur mesure » de son espace, ou l’équipe enregistre sa réponse.
6. **Validation institutionnelle** : un approbateur approuve ; une copie de la formation est figée (version).
7. **Publication** : l’équipe pédagogique publie la formation (« Approuver et publier ») — impossible avant l’approbation.
8. **Lancement** : « Lancer dans l’espace du client » ; l’administrateur de l’entreprise l’affecte ensuite à ses collaborateurs.

Mise à jour d’une formation lancée : « Préparer une nouvelle version », puis revues et approbation comme la première fois.

## 7. Contrats et utilisation

1. Sur une **proposition acceptée**, **Préparer le contrat** : les lignes de la proposition sont reprises.
2. **Modifier** : modèle de tarification, dates, limites (collaborateurs, stockage, vidéo), support, propriété des données et des contenus, résiliation, espace de formation rattaché.
3. **Soumettre à la revue interne** ; un **approbateur** approuve. La signature a lieu hors de la plateforme : l’approbateur joint l’**exemplaire signé** (PDF) puis **enregistre la signature** avec la date.
4. **Démarrer le contrat**, puis **Appliquer les limites à l’espace de formation**.
5. Chaque mois, sur la page de l’espace : **Enregistrer le relevé** (actifs, inscrits, parcours terminés, stockage). Un **dépassement** est signalé : indiquez la suite donnée (avenant, régularisation…). Rien n’est facturé automatiquement.
6. À l’approche de l’échéance (rappel dans « À surveiller ») : **Ouvrir le renouvellement**, fixer la nouvelle échéance, puis **reprendre** le contrat — ou le **clore** avec un motif.

## 8. Finances (montants enregistrés, rien n’est facturé par la plateforme)

- **Factures** : sur la page du contrat (carte « Facturation »), enregistrez chaque facture émise par la comptabilité (son numéro, catégorie, montant, dates). Une facture annulée garde son motif (avoir).
- **Paiements** : enregistrez chaque paiement reçu ; il ne peut pas dépasser le reste dû. Une **autre personne** (approbateur ou administrateur) le **confirme** après vérification du relevé bancaire (page **Finances**, « Paiements à confirmer »).
- **Coûts** : page **Finances** → « Nouveau coût » : catégorie, montant, date, contrat concerné (coût direct) ou coût général, réel ou **estimation**.
- **Lecture** : contracté, facturé, reçu, confirmé, reste dû et coûts, par devise et par année ; marge et coût par collaborateur affichés comme **estimations**.
- Sur la fiche d’une organisation, la carte **« Relation avec la Fondation »** montre côte à côte le partenariat (dons, contributions, impact) et les services aux entreprises (contrats, espaces, facturé) — jamais additionnés.

## 9. Données personnelles

Les demandes qui n’aboutissent pas sont supprimées au plus tard 24 mois après leur clôture (politique de confidentialité, §9). Les documents sont stockés dans un espace privé et vérifiés à l’arrivée (un faux PDF est refusé).
