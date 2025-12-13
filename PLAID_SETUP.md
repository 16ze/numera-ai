# Configuration Plaid pour la Connexion Bancaire

Cette application utilise **Plaid** pour connecter des comptes bancaires et synchroniser automatiquement les transactions.

## 📋 Prérequis

1. **Créer un compte Plaid** : [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. **Obtenir vos clés API** dans le dashboard Plaid

---

## 🔑 Configuration des Variables d'Environnement

Ajoutez les variables suivantes dans votre fichier `.env.local` :

```env
# Plaid Configuration
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox

# URL de votre application (pour les redirections Plaid)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Explication des variables :

- **PLAID_CLIENT_ID** : Votre Client ID (disponible dans le dashboard Plaid)
- **PLAID_SECRET** : Votre Secret (Sandbox/Development/Production selon l'environnement)
- **PLAID_ENV** : Environnement Plaid
  - `sandbox` : Tests avec des banques fictives (gratuit)
  - `development` : Tests avec de vraies banques (limité à 100 items)
  - `production` : Production (nécessite un accord avec Plaid)
- **NEXT_PUBLIC_APP_URL** : URL de base de votre application

---

## 🏗️ Étapes d'Installation

### 1. Créer un Compte Plaid

1. Rendez-vous sur [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Créez un compte (gratuit pour le Sandbox)
3. Vérifiez votre email

### 2. Obtenir vos Clés API

1. Connectez-vous au [Dashboard Plaid](https://dashboard.plaid.com/)
2. Dans le menu, allez sur **Team Settings** → **Keys**
3. Copiez votre **client_id**
4. Copiez votre **sandbox secret** (pour commencer)

### 3. Configurer les Produits

1. Dans le dashboard, allez sur **Team Settings** → **Products**
2. Assurez-vous que **Transactions** est activé
3. Sauvegardez les modifications

### 4. Configurer les Webhooks (Optionnel)

Pour recevoir des notifications automatiques lors de nouvelles transactions :

1. Allez sur **Team Settings** → **Webhooks**
2. Ajoutez l'URL de votre webhook : `https://votre-domaine.com/api/plaid/webhook`
3. Activez les événements **Transactions**

---

## 🧪 Tester avec le Sandbox

En mode Sandbox, vous pouvez tester avec des banques fictives.

### Identifiants de Test Plaid

Lors de la connexion via Plaid Link :

- **Institution** : Cherchez "Platypus" (banque de test Plaid)
- **Username** : `user_good`
- **Password** : `pass_good`

Plaid propose plusieurs scénarios de test :
- `user_good` / `pass_good` : Connexion réussie
- `user_bad` / `pass_bad` : Échec de connexion
- Plus de scénarios : [Plaid Sandbox Testing](https://plaid.com/docs/sandbox/test-credentials/)

---

## 🚀 Passer en Production

### 1. Vérification de l'Application

Avant de demander l'accès à la production :
- Testez toutes les fonctionnalités en Sandbox
- Implémentez la gestion des erreurs
- Ajoutez des logs pour le debugging
- Vérifiez la sécurité (chiffrement des tokens)

### 2. Demander l'Accès Production

1. Dans le dashboard Plaid, allez sur **Team Settings** → **API Access**
2. Cliquez sur **Request Production Access**
3. Remplissez le questionnaire :
   - Décrivez votre use case
   - Expliquez comment vous utilisez Plaid
   - Fournissez des captures d'écran
4. Attendez l'approbation de Plaid (peut prendre quelques jours)

### 3. Mise à Jour des Clés

Une fois approuvé :
1. Récupérez votre **Production Secret**
2. Mettez à jour `.env.local` :
   ```env
   PLAID_SECRET=your_production_secret_here
   PLAID_ENV=production
   ```

---

## 🔐 Sécurité

### ⚠️ Important : Protection des Access Tokens

Les **Access Tokens** Plaid donnent un accès direct aux comptes bancaires. En production, vous **DEVEZ** :

1. **Chiffrer les tokens** avant de les stocker en base de données
2. **Ne jamais** exposer les tokens côté client
3. Utiliser HTTPS en production
4. Implémenter une rotation des tokens

### Exemple de Chiffrement (à implémenter)

```typescript
import crypto from "crypto";

// Chiffrement
const encrypt = (text: string) => {
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!),
    iv
  );
  // ... logique de chiffrement
};

// Déchiffrement
const decrypt = (encryptedText: string) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!),
    iv
  );
  // ... logique de déchiffrement
};
```

---

## 📊 Synchronisation des Transactions

### Fonctionnement

1. L'utilisateur connecte son compte via Plaid Link
2. L'application récupère un **Access Token**
3. Cet Access Token est sauvegardé en base de données
4. La synchronisation utilise `plaidClient.transactionsSync` pour récupérer les nouvelles transactions
5. Les transactions sont insérées dans la table `Transaction`

### Mapping des Catégories

L'application mappe les catégories Plaid vers votre système :

| Catégorie Plaid | Catégorie App |
|----------------|---------------|
| Transport, Travel, Gas | TRANSPORT |
| Food, Restaurant | REPAS |
| Shops, Supplies | MATERIEL |
| Service, Professional | PRESTATION |
| Tax, Government | IMPOTS |
| Payroll, Salary | SALAIRES |
| Autres | AUTRE |

---

## 🐛 Dépannage

### Erreur : "Invalid credentials"

- Vérifiez que `PLAID_CLIENT_ID` et `PLAID_SECRET` sont corrects
- Assurez-vous d'utiliser le bon Secret (Sandbox vs Production)

### Erreur : "Product not enabled"

- Dans le dashboard Plaid, activez le produit **Transactions**

### Erreur : "Access token is no longer valid"

- Le token peut expirer si :
  - L'utilisateur a changé son mot de passe bancaire
  - La connexion a été révoquée
- Solution : Redemander à l'utilisateur de se reconnecter via Plaid Link

### Les transactions ne se synchronisent pas

- Vérifiez que le compte a bien un `accessToken` valide
- En Sandbox, les transactions peuvent prendre quelques minutes à apparaître
- Regardez les logs dans la console pour les erreurs

---

## 📚 Ressources Utiles

- [Documentation Plaid](https://plaid.com/docs/)
- [Plaid API Reference](https://plaid.com/docs/api/)
- [Transactions Sync API](https://plaid.com/docs/api/products/transactions/#transactionssync)
- [Plaid Quickstart (Next.js)](https://github.com/plaid/quickstart)
- [Sandbox Testing](https://plaid.com/docs/sandbox/test-credentials/)

---

## 💡 Bonnes Pratiques

1. **Logs** : Ajoutez des logs pour chaque étape (création token, sync, erreurs)
2. **Retry Logic** : Implémentez une logique de retry en cas d'échec réseau
3. **Webhooks** : Utilisez les webhooks Plaid pour une synchronisation en temps réel
4. **Rate Limiting** : Respectez les limites de l'API Plaid
5. **Monitoring** : Surveillez les erreurs d'accès aux comptes (tokens expirés)

---

## ✅ Checklist de Déploiement

- [ ] Variables d'environnement configurées en production
- [ ] Access Tokens chiffrés en base de données
- [ ] HTTPS activé
- [ ] Webhooks configurés (optionnel)
- [ ] Logs de monitoring en place
- [ ] Gestion des erreurs testée
- [ ] Accès Production approuvé par Plaid
- [ ] Documentation utilisateur disponible

