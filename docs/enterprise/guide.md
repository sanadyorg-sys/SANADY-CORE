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

**Formules de service** (menu **Formules de service**) : des offres types réutilisables pour aller plus vite.

1. Le responsable entreprises crée une formule : nom, service, modèle de tarification, limites (collaborateurs, stockage, vidéo), niveau et engagements de support, puis ses **lignes chiffrées** (aucun prix n’est fixé par la plateforme).
2. Un **approbateur** l’approuve (« Approuver la formule »). Toute modification la repasse en brouillon et demande une nouvelle approbation ; une formule peut être archivée puis rétablie.
3. Sur une proposition **en brouillon**, « Formule de service » → **Appliquer** : ses lignes sont ajoutées à la proposition, où elles restent modifiables. Une formule dans une autre devise ne s’applique qu’à une proposition vide (les montants ne sont jamais convertis).
4. La proposition suit ensuite son circuit habituel (revue, approbation, envoi). Le contrat préparé à partir d’elle reprend le modèle de tarification, les limites et le support de la formule — modifiables dans le contrat en brouillon.

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

**Règles d’évaluation** (page de l’espace, carte « Règles d’évaluation ») : par défaut, la règle SANADY s’applique — 70 % pour réussir, 3 tentatives, bonnes réponses montrées après la réussite, document à la fin. Si le contrat le prévoit :

1. Le responsable entreprises définit des **règles propres** : seuil de réussite (50 à 100 %), nombre de tentatives (1 à 10), quand montrer les bonnes réponses (après la réussite, après chaque tentative, jamais), délivrance ou non du document de fin, et fermeture des évaluations à la **date limite** que l’entreprise fixe en affectant une formation.
2. Un **approbateur** les approuve ; elles ne s’appliquent qu’ensuite. Toute modification demande une nouvelle approbation ; « Revenir à la règle SANADY » les retire.
3. Elles s’appliquent aux collaborateurs de l’entreprise, sur les formations que l’entreprise leur a affectées ou qui lui appartiennent, et **seulement aux nouvelles tentatives** (une tentative garde la règle de son début). Les enseignants de SANADY ne sont jamais concernés. L’administrateur de l’entreprise les voit dans « Formations autorisées ».

Tout est appliqué par la base de données : un collaborateur ne peut ni changer son score ni obtenir une tentative de plus.

**Logo de l’entreprise** (page de l’espace, carte « Logo de l’entreprise ») : le responsable entreprises enregistre le logo fourni par l’entreprise — PNG ou JPEG, 1 Mo au plus (le SVG est refusé). Il apparaît dans l’en-tête de l’espace de l’entreprise et de ses collaborateurs, et à côté du logo de la Fondation (qui reste) sur les attestations et certificats des formations propres à l’entreprise. Remplacer ou retirer le logo supprime l’ancien fichier.

**Ensuite**, l’administrateur de l’entreprise invite ses collaborateurs (un par un ou par liste/CSV), crée des **services**, affecte les formations et suit la progression. La limite de collaborateurs du contrat est appliquée automatiquement (invitations en attente comprises).

**Fin de contrat** : « Enregistrer la fin du contrat » (motif obligatoire) → plus aucune nouvelle invitation → un approbateur **autorise l’export** → fixez la **date de suppression** des données → **Fermer l’espace** (accès retirés). Rien n’est supprimé immédiatement.

## 6. Studio de production (formations sur mesure)

Menu **Studio de production**. Un projet se crée depuis la fiche du client (**Nouveau projet**).

1. **Besoins** : public, objectifs, contraintes, langue, durée, propriété du contenu, espace du client, revue du client prévue ou non.
2. **Conception** : ajoutez les modules du **programme**, puis **Créer la formation à partir du programme** (brouillon réservé au client).
3. **Production** : ajoutez les **formateurs** (ils écrivent la formation dans l’éditeur habituel : vidéos, PDF, évaluations) et les **tâches** (vidéo, PDF, évaluation…). Chacun termine ses tâches depuis le Studio.
4. **Revue pédagogique** : « Soumettre à la revue pédagogique » (toutes les tâches terminées, formation complète) ; un responsable pédagogique valide ou demande des modifications.
5. **Revue du client** (si prévue) : l’administrateur de l’entreprise valide le programme dans « Formations sur mesure » de son espace, ou l’équipe enregistre sa réponse. Pendant la revue du client et la validation institutionnelle, il peut **« Voir le contenu de la formation »** : les vraies leçons (vidéos, PDF, fichiers joints) et les questions des évaluations, en lecture seule — sans les bonnes réponses, sans rien enregistrer. L’aperçu se ferme une fois la formation approuvée ; les collaborateurs n’y ont pas accès.
6. **Validation institutionnelle** : un approbateur approuve ; une copie de la formation est figée (version).
7. **Publication** : l’équipe pédagogique publie la formation (« Approuver et publier ») — impossible avant l’approbation.
8. **Lancement** : « Lancer dans l’espace du client » ; l’administrateur de l’entreprise l’affecte ensuite à ses collaborateurs.

Mise à jour d’une formation lancée : « Préparer une nouvelle version », puis revues et approbation comme la première fois.

**Restaurer une version** (carte « Versions approuvées ») : pendant la préparation d’une nouvelle version (conception ou production), le responsable de production peut **« Restaurer cette version »**. Le contenu de la formation redevient celui de la version choisie : leçons, textes, évaluations et questions. Rien n’est supprimé — ce qui n’y figure pas est archivé — et les leçons déjà suivies (même vidéo ou même PDF) sont reprises avec la progression des collaborateurs. La formation est ensuite relue et approuvée à nouveau. Chaque restauration est inscrite dans l’historique.

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
- **Graphique « Facturé et reçu par mois »** pour chaque devise ; survolez un mois pour lire les montants, « Afficher les données » donne le tableau.
- **Exports CSV pour la comptabilité** (en haut de la page, pour l’année choisie) : factures (avec reçu et reste dû), paiements (confirmés ou non), coûts (réels ou estimés), contrats. Réservés au responsable entreprises, aux administrateurs et aux approbateurs.
- Sur la fiche d’une organisation, la carte **« Relation avec la Fondation »** montre côte à côte le partenariat (dons, contributions, impact) et les services aux entreprises (contrats, espaces, facturé) — jamais additionnés.

## 9. Assistance (demandes des entreprises)

**Côté entreprise** : l’administrateur de l’entreprise ouvre une demande dans **Assistance** de son espace (type, priorité, objet, description). Il voit le niveau de support prévu au contrat. Les collaborateurs passent par leur administrateur.

**Côté équipe** : menu **Assistance**.

1. Ouvrez la demande, choisissez qui la suit (**Suivie par**).
2. **Répondre à l’entreprise** envoie un message visible par l’entreprise ; **Ajouter une note interne** reste visible par l’équipe uniquement (fond jaune).
3. Faites avancer : **en cours** → **attendre la réponse de l’entreprise** → **résolue**. Une réponse de l’entreprise remet la demande « en cours ». L’entreprise peut **rouvrir** une demande résolue ou la **fermer** ; l’équipe la ferme une fois résolue.
4. La page montre la charge réelle : demandes à traiter, urgentes sans réponse, délai médian de première réponse, incidents sur 90 jours, demandes par entreprise. Les engagements de support du contrat s’affichent sur chaque demande.

« À surveiller » (page Demandes entreprises) signale les demandes à traiter et les urgentes sans réponse. Les notifications par e-mail viendront avec la configuration de l’envoi d’e-mails.

## 10. Données personnelles

Les demandes qui n’aboutissent pas sont supprimées au plus tard 24 mois après leur clôture (politique de confidentialité, §9). Les documents sont stockés dans un espace privé et vérifiés à l’arrivée (un faux PDF est refusé).
