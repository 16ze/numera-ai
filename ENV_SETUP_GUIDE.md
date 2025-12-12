# 🔐 Guide de Configuration des Variables d'Environnement

## ✅ ÉTAPE 1 : Créer le fichier .env

1. **Copiez le fichier exemple** :

   ```bash
   cp .env.example .env
   ```

2. **OU créez manuellement** un fichier `.env` à la racine du projet

---

## 🔑 ÉTAPE 2 : Configurer Clerk (OBLIGATOIRE)

### Récupérer vos clés Clerk

1. Allez sur : https://dashboard.clerk.com
2. Sélectionnez votre projet (ou créez-en un)
3. Dans le menu de gauche, cliquez sur **"API Keys"**
4. Copiez les deux clés :

### Variables Clerk requises

```env
# Clé publique (commence par pk_test_ ou pk_live_)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Clé secrète (commence par sk_test_ ou sk_live_)
CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### ⚠️ IMPORTANT

- ✅ **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** : Commence par `pk_test_` (dev) ou `pk_live_` (prod)
- ✅ **CLERK_SECRET_KEY** : Commence par `sk_test_` (dev) ou `sk_live_` (prod)
- ❌ **NE COMMITEZ JAMAIS** le fichier `.env` dans Git (déjà dans `.gitignore`)
- ✅ Les clés de **test** et de **production** sont différentes

---

## 🗄️ ÉTAPE 3 : Configurer la Base de Données (OBLIGATOIRE)

### Format de la DATABASE_URL

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

### Exemple avec Supabase

```env
DATABASE_URL=postgresql://postgres.xxxxx:MOT_DE_PASSE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### Où trouver votre DATABASE_URL Supabase

1. Allez sur : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **"Settings"** → **"Database"**
4. Copiez la **"Connection string"** (section "Connection pooling")
5. Remplacez `[YOUR-PASSWORD]` par votre mot de passe

---

## 🤖 ÉTAPE 4 : Configurer OpenAI (OBLIGATOIRE pour l'assistant CFO)

### Récupérer votre clé OpenAI

1. Allez sur : https://platform.openai.com/api-keys
2. Cliquez sur **"Create new secret key"**
3. Copiez la clé (elle commence par `sk-`)

```env
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## ✅ ÉTAPE 5 : Vérifier votre configuration

### Fichier .env complet (exemple)

```env
# CLERK
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# DATABASE
DATABASE_URL=postgresql://postgres:password@localhost:5432/numera_ai

# OPENAI
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# NEXT.JS
NODE_ENV=development
```

---

## 🚀 ÉTAPE 6 : Redémarrer le serveur

Après avoir modifié le fichier `.env` :

```bash
# Arrêter le serveur (Ctrl+C)

# Redémarrer
npm run dev
```

---

## 🔍 VÉRIFICATION

### Comment savoir si Clerk est bien configuré ?

1. Allez sur `http://localhost:3000/sign-in`
2. Vous devez voir le formulaire de connexion Clerk (pas d'erreur)
3. Dans la console du navigateur (F12), vous ne devez PAS voir :
   - ❌ "Clerk: Missing publishable key"
   - ❌ "Clerk: Invalid API key"

### Erreurs courantes

| Erreur                         | Cause                                        | Solution                              |
| ------------------------------ | -------------------------------------------- | ------------------------------------- |
| "Missing publishable key"      | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` manquant | Ajoutez la clé dans `.env`            |
| "Invalid API key"              | Mauvaise clé ou clé expirée                  | Vérifiez sur dashboard.clerk.com      |
| "Database connection failed"   | `DATABASE_URL` incorrect                     | Vérifiez le format et les credentials |
| Formulaire Clerk ne charge pas | Middleware trop restrictif                   | Utilisez le middleware.ts fourni      |

---

## 📝 CHECKLIST FINALE

- [ ] Fichier `.env` créé à la racine du projet
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` configuré (commence par `pk_test_`)
- [ ] `CLERK_SECRET_KEY` configuré (commence par `sk_test_`)
- [ ] `DATABASE_URL` configuré (format PostgreSQL)
- [ ] `OPENAI_API_KEY` configuré (commence par `sk-`)
- [ ] Serveur redémarré après modification du `.env`
- [ ] Page `/sign-in` affiche le formulaire Clerk
- [ ] Aucune erreur dans la console du navigateur

---

## 🆘 BESOIN D'AIDE ?

Si vous avez toujours des problèmes :

1. **Vérifiez les logs du serveur** : Regardez le terminal où tourne `npm run dev`
2. **Vérifiez la console du navigateur** : Appuyez sur F12
3. **Testez en mode navigation privée** : Pour éliminer les problèmes de cache
4. **Vérifiez que le fichier .env est bien à la racine** : Pas dans un sous-dossier

---

## 🎉 SUCCÈS

Si vous voyez le formulaire de connexion Clerk et pouvez vous connecter, **votre configuration est correcte** ! ✅

