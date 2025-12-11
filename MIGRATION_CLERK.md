# 🗄️ MIGRATION PRISMA POUR CLERK

## 📋 ÉTAPES DE MIGRATION

### 1️⃣ Générer la migration

Cette commande va créer le fichier de migration SQL pour ajouter le champ `clerkUserId` :

```bash
cd /Users/bryandev/Documents/numera-ai
npx prisma migrate dev --name add_clerk_user_id
```

Cette commande va :
- ✅ Créer un fichier de migration dans `prisma/migrations/`
- ✅ Appliquer la migration à votre base de données Supabase
- ✅ Régénérer le Prisma Client avec le nouveau champ

### 2️⃣ Alternative : Migration SQL manuelle

Si vous préférez créer la migration manuellement, créez le fichier :
`prisma/migrations/YYYYMMDDHHMMSS_add_clerk_user_id/migration.sql`

Avec le contenu suivant :

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "clerkUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE INDEX "users_clerkUserId_idx" ON "users"("clerkUserId");
```

Puis appliquez-la :

```bash
npx prisma migrate deploy
```

---

## ⚠️ GESTION DES DONNÉES EXISTANTES

### Problème : Users existants sans clerkUserId

Si vous avez déjà des utilisateurs dans votre base (comme `demo@numera.ai`), ils n'auront pas de `clerkUserId` et le champ est maintenant **obligatoire et unique**.

### Solutions

#### Option 1 : Supprimer les utilisateurs de test (RECOMMANDÉ)

Si vous n'avez que des données de test :

```sql
-- Se connecter à Supabase SQL Editor et exécuter :
DELETE FROM "users" WHERE email = 'demo@numera.ai';
```

Avantages :
- ✅ Base de données propre
- ✅ Pas de données orphelines
- ✅ Tous les nouveaux utilisateurs viendront de Clerk

#### Option 2 : Rendre le champ optionnel temporairement

Si vous devez conserver les données existantes :

1. Modifiez `schema.prisma` :
```prisma
model User {
  clerkUserId String? @unique // Rendre optionnel avec ?
  // ...
}
```

2. Créez une nouvelle migration :
```bash
npx prisma migrate dev --name make_clerk_id_optional
```

3. Plus tard, quand tous les users auront un Clerk ID, vous pourrez le rendre obligatoire

#### Option 3 : Migrer les users existants

Si vous voulez garder `demo@numera.ai` et créer un compte Clerk pour lui :

1. Créez un compte Clerk avec `demo@numera.ai`
2. Récupérez son Clerk User ID (dans le dashboard Clerk)
3. Mettez à jour la base :

```sql
UPDATE "users" 
SET "clerkUserId" = 'user_XXXXXXXXXXXXX' 
WHERE email = 'demo@numera.ai';
```

---

## 🔄 RÉGÉNÉRER LE PRISMA CLIENT

Après toute modification du schema :

```bash
npx prisma generate
```

---

## ✅ VÉRIFIER LA MIGRATION

```bash
# Voir l'état des migrations
npx prisma migrate status

# Ouvrir Prisma Studio pour vérifier les données
npx prisma studio
```

---

## 🎯 ORDRE DES OPÉRATIONS RECOMMANDÉ

```bash
# 1. Nettoyer les données de test (optionnel)
# Aller sur Supabase > SQL Editor > Exécuter :
# DELETE FROM "users" WHERE email = 'demo@numera.ai';

# 2. Créer la migration
cd /Users/bryandev/Documents/numera-ai
npx prisma migrate dev --name add_clerk_user_id

# 3. Vérifier que tout est OK
npx prisma migrate status

# 4. Régénérer le client Prisma
npx prisma generate

# 5. Redémarrer le serveur Next.js
npm run dev
```

---

## 🐛 DÉPANNAGE

### Erreur : "Unique constraint failed"

➡️ Vous avez des utilisateurs sans `clerkUserId`. Supprimez-les ou rendez le champ optionnel.

### Erreur : "Migration failed"

➡️ Vérifiez votre connexion Supabase dans `.env` :
```
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

### Erreur : "Prisma Client out of sync"

➡️ Régénérez le client :
```bash
npx prisma generate
```

---

## 📝 APRÈS LA MIGRATION

Une fois la migration terminée :

1. ✅ Le champ `clerkUserId` existe dans la table `users`
2. ✅ Il a un index unique pour les recherches rapides
3. ✅ Le Prisma Client est à jour
4. ✅ `getAuthUser()` peut créer de nouveaux utilisateurs automatiquement

**🎉 Vous êtes prêt à synchroniser Clerk avec Prisma !**

