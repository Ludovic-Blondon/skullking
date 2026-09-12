# Les 12 testeurs du test fermé

Un compte développeur **personnel créé après le 13/11/2023** n'a pas accès à la production tant
qu'il n'a pas montré **12 testeurs inscrits pendant 14 jours continus** sur une piste de **test
fermé**. C'est le chemin critique de la sortie Android — plus long que la validation elle-même,
et le seul que le code ne peut pas raccourcir.

## Ce qui compte, et ce qui ne compte pas

| Compte                                    | Ne compte pas                                  |
| ----------------------------------------- | ---------------------------------------------- |
| Piste de **test fermé** (`alpha` en API)  | Piste **interne**, quel que soit le nombre     |
| Testeurs **opt-in** et restés inscrits    | Un désistement : le compteur repart de zéro    |
| Comptes **Google** distincts, sur Android | TestFlight, un proche sur iPhone, un émulateur |
| Des gens qui **ouvrent** l'app            | Une installation jamais lancée                 |

Le compteur des 14 jours ne démarre pas à la promotion de la build : il démarre quand les
testeurs sont inscrits. Une piste fermée servie mais sans liste attend indéfiniment.

Google ne l'expose pas par API — ni le nombre, ni la date de départ. Cet écran-là se regarde dans
la console, page _Test fermé_.

## Monter la liste

1. Créer un groupe sur [groups.google.com](https://groups.google.com) — par exemple
   `skull-scores-testeurs@googlegroups.com`. C'est la seule forme de liste que l'API accepte, et
   la plus maniable : on ajoute et retire les gens dans le groupe, sans repasser par Play.
2. L'attacher à la piste :

   ```bash
   python3 docs/store/promote-play-track.py --vers alpha --groupe skull-scores-testeurs@googlegroups.com
   ```

3. Envoyer le lien d'inscription, et **seulement lui** — l'app n'est pas trouvable par la
   recherche du Play Store tant qu'elle est en test fermé :
   <https://play.google.com/apps/testing/com.lblondon.skullscores>

Le piège classique, et il coûte des jours : le testeur clique le lien connecté à une adresse, et
installe depuis un téléphone connecté à une **autre**. Il faut le compte Google **actif sur le
téléphone**, celui du Play Store. Le dire dans le message, pas après.

## Où les trouver

Par ordre de rendement :

- **Les gens qui jouent déjà au Skull King.** C'est la cible exacte de l'app, et douze personnes
  autour d'une table s'atteignent en deux soirées. Ce sont aussi les seuls dont les retours
  valent quelque chose.
- **Les communautés du jeu** : le forum Skull King sur BoardGameGeek, les groupes Facebook du
  jeu, les serveurs Discord de jeux de cartes. Un message qui parle du barème et des bonus de
  capture y est lu ; un message qui demande « 12 testeurs » ne l'est pas.
- **Les groupes d'entraide entre développeurs** (r/androidtesters, r/AlphaandBetaUsers et leurs
  équivalents Discord). Ils font le nombre en quelques jours, mais ce sont des inscrits qui
  ouvrent l'app une fois : Google contrôle l'usage réel, et une piste peuplée uniquement de
  testeurs réciproques est un pari. À utiliser pour compléter, pas pour tenir les douze.

Une marge est prudente : viser **15 inscrits** pour en garder 12 pendant deux semaines.

## Le message

### Français

> Salut ! J'ai écrit une petite app Android qui compte les points au **Skull King** — annonces,
> plis, bonus de capture, Kraken, Baleine blanche, le barème complet de la boîte. Gratuite, hors
> ligne, sans pub et sans compte.
>
> Pour la publier sur le Play Store, Google me demande 12 testeurs pendant 14 jours. Il faut
> deux minutes :
>
> 1. Ouvre ce lien : https://play.google.com/apps/testing/com.lblondon.skullscores
> 2. Accepte de devenir testeur, puis installe l'app depuis le Play Store.
> 3. Ouvre-la une fois — et si tu joues, sers-t'en à ta prochaine partie, les retours
>    m'intéressent.
>
> Un détail qui coince souvent : **utilise le compte Google de ton téléphone**, celui du Play
> Store, sinon le lien ne donne rien. Et surtout, reste inscrit deux semaines : si quelqu'un se
> désinscrit, le compteur repart à zéro pour tout le monde.
>
> Merci !

### English

> Hi! I built a small Android app that keeps score for **Skull King** — bids, tricks, capture
> bonuses, Kraken, White Whale, the whole scoring sheet. Free, offline, no ads, no account.
>
> To publish it on the Play Store, Google requires 12 testers for 14 days. It takes two minutes:
>
> 1. Open this link: https://play.google.com/apps/testing/com.lblondon.skullscores
> 2. Accept the tester invitation, then install the app from the Play Store.
> 3. Open it once — and if you play, use it in your next game; I'd love the feedback.
>
> One thing that trips people up: **use the Google account signed in on your phone**, the Play
> Store one, or the link won't do anything. And please stay opted in for the two weeks — if
> someone leaves, the counter resets for everyone.
>
> Thanks!

### Version courte (SMS, WhatsApp)

> Mon app de score pour le Skull King sort sur Android, il me faut 12 testeurs pendant 14 jours.
> Tu ouvres https://play.google.com/apps/testing/com.lblondon.skullscores avec le compte Google
> de ton téléphone, tu acceptes, tu installes, tu ouvres une fois. Deux minutes, et tu restes
> inscrit 15 jours. Merci !

## Pendant les 14 jours

- Ne retirer personne du groupe, et ne pas dépublier la piste.
- Une nouvelle build se promeut sans rien casser : les testeurs restent inscrits.
- Au terme, la demande d'accès production se fait dans la console — Google pose alors des
  questions sur ce que le test a donné (retours reçus, ce qui a changé). Garder une trace des
  remarques rend cette page beaucoup plus rapide à remplir.
