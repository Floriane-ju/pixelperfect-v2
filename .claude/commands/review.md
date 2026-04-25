---
description: Review des changements en cours (correctness, sécurité, style, perf canvas)
---

Lis `git diff` (staged + unstaged) et passe en revue :

- Logique : edge cases manqués, états incohérents, races sur le canvas/calques.
- Sécurité : pas de secret hardcodé, validation des entrées (import image de référence, palette hex).
- Style : conformité avec `.claude/rules/coding-style.md` (variables SCSS, alias `@/`, pas d'`any`, pas de `console.log`).
- PWA : conformité avec `.claude/rules/pwa.md` (Pointer Events, `100dvh`, safe-area).
- Tests manquants pour la logique métier introduite.

Reporte par sévérité : **BLOCKER** / **WARN** / **SUGGESTION**.
