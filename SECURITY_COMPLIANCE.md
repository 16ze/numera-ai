# Document de Conformité Sécurité - Numera AI

Ce document décrit les mesures de sécurité mises en place par Numera AI pour garantir la protection des données utilisateurs et la conformité aux exigences de sécurité de Plaid.

---

## Section 1 : Authentification Multifacteurs pour les Utilisateurs Finaux (End-User MFA)

### Contexte

Numera AI délègue l'authentification de ses utilisateurs à **Clerk**, un fournisseur d'identité (Identity Provider) certifié **SOC 2 Type 2** et conforme au RGPD.

### Gestion du MFA par Clerk

Clerk gère nativement l'authentification multifacteurs (MFA) pour tous les utilisateurs de l'application. Les méthodes de MFA disponibles incluent :

- **Code par email** : Envoi d'un code de vérification à l'adresse email de l'utilisateur
- **Code par SMS** : Envoi d'un code de vérification par SMS (si configuré)
- **Application d'authentification** : Support des applications d'authentification (Google Authenticator, Authy, etc.) via TOTP (Time-based One-Time Password)

### Protection des Routes Sensibles

L'accès à Plaid Link, l'interface de connexion bancaire, est strictement protégé :

1. **Authentification requise** : Toutes les routes menant à Plaid Link sont protégées par l'authentification Clerk via le middleware Next.js
2. **MFA obligatoire** : Les utilisateurs doivent avoir complété leur authentification multifacteurs via Clerk avant d'accéder à l'interface de connexion bancaire
3. **Isolation des fonctionnalités** : Plaid Link n'est accessible que derrière une route protégée (`/settings/bank`), elle-même accessible uniquement aux utilisateurs authentifiés

### Flux d'Authentification

```
1. Utilisateur accède à l'application
   ↓
2. Redirection vers Clerk pour authentification
   ↓
3. Authentification via email/password + MFA (si activé)
   ↓
4. Token d'accès Clerk généré et validé
   ↓
5. Accès à l'application (utilisateur authentifié)
   ↓
6. Accès possible à /settings/bank → Plaid Link
```

### Certifications et Conformité

- **Clerk** : Certifié SOC 2 Type 2, conforme au RGPD
- **Plaid** : Certifié PCI DSS Level 1, conforme aux standards bancaires

---

## Section 2 : Authentification Multifacteurs pour l'Accès Interne (Internal Access MFA)

### Restriction d'Accès aux Systèmes Critiques

L'accès aux systèmes critiques de Numera AI est strictement restreint aux administrateurs autorisés. Ces systèmes incluent :

- **Base de données** : PostgreSQL hébergée par Supabase
- **Code source** : Dépôt GitHub privé
- **Déploiement** : Plateforme Vercel
- **Stockage de fichiers** : Supabase Storage
- **Gestion des secrets** : Variables d'environnement Vercel

### Authentification Multifacteurs Obligatoire

Tous les administrateurs doivent activer l'authentification multifacteurs (2FA) sur les plateformes suivantes :

#### 1. Vercel (Déploiement et Infrastructure)

- **2FA obligatoire** : Tous les membres de l'équipe doivent activer le 2FA
- **Méthodes supportées** : Authenticator App (TOTP), SMS, ou clés de sécurité matérielles
- **Vérification périodique** : Les administrateurs sont tenus de vérifier que leur 2FA est actif

#### 2. Supabase (Base de Données et Stockage)

- **2FA obligatoire** : Accès aux projets Supabase protégés par 2FA
- **Rôles et permissions** : Principe du moindre privilège appliqué
- **Audit des accès** : Logs de tous les accès à la base de données

#### 3. GitHub (Code Source)

- **2FA obligatoire** : Tous les membres de l'organisation doivent activer le 2FA
- **Méthodes supportées** : Authenticator App, SMS, ou clés de sécurité
- **Protection du dépôt** : Dépôt privé avec accès restreint
- **Branches protégées** : La branche `main` nécessite des pull requests approuvées

### Gestion des Secrets et Clés API

#### Stockage Sécurisé

Les clés API et secrets ne sont **jamais** stockés :

- ❌ Dans le code source (fichiers `.env` commités)
- ❌ Sur les machines locales des développeurs
- ❌ Dans des documents partagés ou emails

#### Injection via Variables d'Environnement

Tous les secrets sont injectés via des variables d'environnement sécurisées :

- **Vercel** : Variables d'environnement chiffrées et gérées via le dashboard Vercel
- **Supabase** : Secrets stockés dans la configuration du projet Supabase
- **Plaid** : Clés API stockées uniquement dans les variables d'environnement Vercel (production)

#### Rotation des Secrets

- **Plaid** : Rotation régulière des clés API selon les bonnes pratiques Plaid
- **Clerk** : Gestion des clés via le dashboard Clerk avec rotation automatique
- **Supabase** : Clés de service régénérées périodiquement

### Mesures de Sécurité Additionnelles

1. **Accès par IP** : Restriction d'accès aux dashboards administrateurs par IP (si possible)
2. **Logs d'audit** : Tous les accès aux systèmes critiques sont loggés et audités
3. **Notifications de sécurité** : Alertes en cas de connexion depuis un nouvel appareil ou localisation
4. **Sessions** : Expiration automatique des sessions après inactivité
5. **Principe du moindre privilège** : Chaque administrateur n'a accès qu'aux systèmes nécessaires à ses fonctions

### Formation et Sensibilisation

- Tous les administrateurs sont formés aux bonnes pratiques de sécurité
- Documentation interne sur la gestion des secrets et l'utilisation du 2FA
- Révision périodique des accès et permissions

---

## Conformité et Certifications

Numera AI s'engage à respecter les standards de sécurité les plus élevés :

- **RGPD** : Conformité avec le Règlement Général sur la Protection des Données
- **SOC 2** : Utilisation de services certifiés SOC 2 (Clerk, Supabase)
- **PCI DSS** : Utilisation de Plaid certifié PCI DSS Level 1
- **ISO 27001** : Infrastructure hébergée chez Supabase certifiée ISO 27001

---

## Contact Sécurité

Pour toute question concernant la sécurité de Numera AI :

**Email** : security@numera.ai

---

*Document généré le : 2024-12-11*
*Version : 1.0*

