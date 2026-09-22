ARCHI-BON — VERSION FUSION V4

Cette version reprend la base et l'interface V3 puis ajoute :
- 🤖 vérification assistée par IA côté serveur Cloudflare Worker ;
- recherche de mentions dans des sources institutionnelles ;
- garde-fous : l'IA revient à ⚪ À VÉRIFIER si les preuves sont insuffisantes ;
- ➕ ajout local de plantes à vérifier ;
- ⭐ favoris locaux ;
- historique local des vérifications IA ;
- export JSON des ajouts ;
- page Sources & méthode ;
- recherche améliorée avec accents, synonymes, noms scientifiques et petites fautes ;
- base enrichie avec des éléments directement documentés par RWAF/RSPCA/Merck ;
- PWA/offline conservée.

DÉPLOIEMENT
1. Déployer ce dossier comme Cloudflare Worker avec Wrangler.
2. Le binding Workers AI doit s'appeler AI.
3. Le binding d'assets doit s'appeler ASSETS.
4. Garder worker.js et public/ ensemble.
5. Ne jamais mettre de clé API dans public/js/app.js.

IMPORTANT
- Les ajouts locaux ne deviennent jamais automatiquement des fiches vérifiées partagées.
- En cas de doute, l'application affiche ⚪ À VÉRIFIER.
- L'application ne remplace pas un vétérinaire.
