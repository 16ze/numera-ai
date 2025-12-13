# 🚨 Configuration Plaid Manquante

Vous avez tenté d'accéder à la page de connexion bancaire, mais les variables d'environnement Plaid ne sont pas configurées.

## ⚡ Configuration Rapide (5 minutes)

### 1. Créer un compte Plaid (Gratuit)

1. Allez sur [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Créez un compte gratuit
3. Vérifiez votre email

### 2. Obtenir vos clés API

1. Connectez-vous au [Dashboard Plaid](https://dashboard.plaid.com/)
2. Allez dans **Team Settings** → **Keys**
3. Copiez votre **client_id**
4. Copiez votre **sandbox secret**

### 3. Ajouter les variables dans `.env.local`

Créez ou modifiez le fichier `.env.local` à la racine du projet et ajoutez :

```env
# Plaid Configuration
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox

# URL de votre application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Redémarrer le serveur

```bash
npm run dev
```

### 5. Tester avec les identifiants Sandbox

Lors de la connexion via Plaid Link :

- **Institution** : Cherchez "Platypus"
- **Username** : `user_good`
- **Password** : `pass_good`

## 📚 Documentation Complète

Consultez le fichier `PLAID_SETUP.md` à la racine du projet pour :
- Guide détaillé de configuration
- Passage en production
- Sécurité et bonnes pratiques
- Dépannage

## ❓ Besoin d'aide ?

Si vous rencontrez des problèmes, vérifiez :
1. Que les variables sont bien dans `.env.local` (pas `.env`)
2. Que le serveur a été redémarré après modification
3. Les logs dans la console pour les erreurs détaillées

---

**Note** : Le mode Sandbox est totalement gratuit et ne nécessite pas de vérification bancaire réelle.

