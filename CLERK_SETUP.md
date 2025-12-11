# 🔐 CONFIGURATION CLERK - GUIDE COMPLET

## 📋 PRÉREQUIS

1. **Libérer de l'espace disque** pour installer les dépendances
2. Avoir un compte Clerk (gratuit) : https://clerk.com
3. Node.js et npm installés

---

## 1️⃣ INSTALLATION

Une fois l'espace disque libéré, exécutez :

```bash
npm install @clerk/nextjs
```

---

## 2️⃣ CONFIGURATION DES CLÉS API

### A. Créer une application Clerk

1. Allez sur https://dashboard.clerk.com
2. Cliquez sur **"Create Application"**
3. Donnez un nom : **"Numera AI"**
4. Sélectionnez les méthodes d'authentification souhaitées :
   - ✅ Email + Password (recommandé)
   - ✅ Google OAuth (optionnel)
   - ✅ GitHub OAuth (optionnel)

### B. Récupérer les clés API

1. Dans le dashboard Clerk, allez dans **"API Keys"**
2. Copiez les clés affichées

### C. Créer le fichier .env.local

Créez un fichier `.env.local` à la racine du projet :

```bash
# CLERK AUTHENTICATION
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_VOTRE_CLE_PUBLIQUE
CLERK_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE

# URLs de redirection Clerk
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

⚠️ **IMPORTANT** : Remplacez `VOTRE_CLE_PUBLIQUE` et `VOTRE_CLE_SECRETE` par vos vraies clés Clerk.

---

## 3️⃣ CRÉER LES PAGES D'AUTHENTIFICATION

Clerk a besoin de pages dédiées pour la connexion et l'inscription.

### A. Page de connexion : `app/sign-in/[[...sign-in]]/page.tsx`

```bash
mkdir -p app/sign-in/\[\[...sign-in\]\]
```

Créez le fichier `app/sign-in/[[...sign-in]]/page.tsx` :

```typescript
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
          },
        }}
      />
    </div>
  );
}
```

### B. Page d'inscription : `app/sign-up/[[...sign-up]]/page.tsx`

```bash
mkdir -p app/sign-up/\[\[...sign-up\]\]
```

Créez le fichier `app/sign-up/[[...sign-up]]/page.tsx` :

```typescript
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
          },
        }}
      />
    </div>
  );
}
```

---

## 4️⃣ REDÉMARRER LE SERVEUR

```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis relancer
npm run dev
```

---

## 5️⃣ TESTER L'AUTHENTIFICATION

1. Accédez à http://localhost:3001 (ou 3000)
2. Vous devriez être redirigé vers `/sign-in`
3. Créez un compte test
4. Vous devriez être redirigé vers le dashboard
5. Vérifiez que le **UserButton** s'affiche en bas de la Sidebar

---

## 🎨 PERSONNALISATION (OPTIONNEL)

### Personnaliser l'apparence de Clerk

Dans `app/layout.tsx`, vous pouvez personnaliser l'apparence :

```typescript
<ClerkProvider
  localization={frFR}
  appearance={{
    baseTheme: undefined, // ou "dark" pour le mode sombre
    variables: {
      colorPrimary: "#2563eb", // Bleu de votre brand
      colorTextOnPrimaryBackground: "#ffffff",
    },
  }}
>
```

### Ajouter des métadonnées utilisateur

Vous pouvez stocker des métadonnées personnalisées :

```typescript
import { currentUser } from "@clerk/nextjs/server";

const user = await currentUser();
console.log(user?.firstName, user?.lastName, user?.emailAddresses);
```

---

## 🔒 SÉCURITÉ - BONNES PRATIQUES

1. ✅ **Ne jamais commiter le fichier .env.local** (déjà dans .gitignore)
2. ✅ **Utiliser des clés différentes** pour dev/prod
3. ✅ **Activer 2FA** dans le dashboard Clerk
4. ✅ **Configurer les webhooks** pour synchroniser avec votre base de données
5. ✅ **Limiter les domaines autorisés** dans les paramètres Clerk

---

## 📊 WEBHOOKS CLERK (RECOMMANDÉ)

Pour synchroniser les utilisateurs Clerk avec votre base Prisma, configurez un webhook :

### 1. Créer le endpoint webhook

Créez `app/api/webhooks/clerk/route.ts` :

```typescript
import { Webhook } from "svix";
import { headers } from "next/headers";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET manquant");
  }

  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Erreur headers manquants", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    return new Response("Erreur de vérification", { status: 400 });
  }

  const { id, email_addresses, first_name, last_name } = evt.data;
  const eventType = evt.type;

  if (eventType === "user.created") {
    await prisma.user.create({
      data: {
        clerkId: id,
        email: email_addresses[0].email_address,
        firstName: first_name || "",
        lastName: last_name || "",
      },
    });
  }

  return new Response("", { status: 200 });
}
```

### 2. Configurer dans Clerk Dashboard

1. Allez dans **"Webhooks"**
2. Ajoutez l'URL : `https://votre-domaine.com/api/webhooks/clerk`
3. Sélectionnez les événements : `user.created`, `user.updated`, `user.deleted`
4. Copiez le **Signing Secret** et ajoutez-le dans `.env.local` :
   ```
   CLERK_WEBHOOK_SECRET=whsec_VOTRE_SECRET
   ```

---

## 🆘 DÉPANNAGE

### Erreur : "Clerk publishable key is missing"
➡️ Vérifiez que `.env.local` existe et contient les bonnes clés

### Erreur : "Invalid key format"
➡️ Assurez-vous de copier la clé complète (commence par `pk_test_` ou `pk_live_`)

### Redirection infinie
➡️ Vérifiez que les routes `/sign-in` et `/sign-up` existent et sont publiques dans `middleware.ts`

### UserButton ne s'affiche pas
➡️ Assurez-vous que `<ClerkProvider>` enveloppe bien toute l'application dans `layout.tsx`

---

## 📚 RESSOURCES

- 📖 [Documentation Clerk](https://clerk.com/docs)
- 🎓 [Guide Next.js + Clerk](https://clerk.com/docs/quickstarts/nextjs)
- 💬 [Discord Clerk](https://clerk.com/discord)
- 🐛 [GitHub Issues](https://github.com/clerk/javascript)

---

## ✅ CHECKLIST FINALE

- [ ] Package @clerk/nextjs installé
- [ ] Fichier .env.local créé avec les clés
- [ ] Pages /sign-in et /sign-up créées
- [ ] Serveur redémarré
- [ ] Authentification testée
- [ ] UserButton visible dans la Sidebar
- [ ] Webhooks configurés (optionnel mais recommandé)

---

**🎉 Félicitations ! Votre application est maintenant sécurisée avec Clerk !**

