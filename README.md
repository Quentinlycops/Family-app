# Famille

Application familiale : agenda partagé, to-do, liste de courses, idées repas et budget.
Next.js (installable sur téléphone) + Firebase (comptes et synchronisation en temps réel), hébergée sur Vercel.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplir avec la config Firebase (Console > Paramètres du projet > Vos applications)
npm run dev
```

Pour développer sans toucher aux vraies données, avec les émulateurs Firebase :

```bash
npx firebase emulators:start --only auth,firestore --project demo-famille
NEXT_PUBLIC_USE_EMULATORS=1 NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-famille NEXT_PUBLIC_FIREBASE_API_KEY=fake npm run dev
```

## Règles de sécurité Firestore

Les règles sont dans `firestore.rules` : seuls les membres d'une famille lisent et modifient ses données.
Après une modification, les coller dans Console Firebase > Firestore > Règles > Publier
(ou `npx firebase deploy --only firestore:rules`).

## Organisation des données

- `users/{uid}` : famille du compte
- `families/{id}` : nom, membres (Cristina, Quentin, Léa, Alba), comptes liés. L'identifiant sert de code d'invitation.
- `families/{id}/events | todos | shopping | recipes | meals | expenses | settings`

## Mise en ligne

Vercel déploie automatiquement chaque push sur `main`. Les variables `NEXT_PUBLIC_FIREBASE_*`
sont définies dans Vercel > family-app > Settings > Environment Variables ; elles sont lues au moment
du build, donc il faut redéployer après les avoir modifiées.
