## Краткое описание

Опишите изменение и его проверяемый эффект.

## Намерение изменения

```repo-guard-yaml
change_type: feature
scope:
  - src/**
budgets: {}
anchors:
  affects: []
  implements: []
  verifies: []
must_touch: []
must_not_touch: []
expected_effects:
  - Опишите ожидаемый эффект
```

## Проверки

- [ ] изменение укладывается в заявленный `scope`;
- [ ] semantic/trusted изменения имеют соответствующие tests/evidence;
- [ ] search/UI/importer не используются как proof authority;
- [ ] CI green;
- [ ] blocking repo-guard green, если guard уже активен на base.
