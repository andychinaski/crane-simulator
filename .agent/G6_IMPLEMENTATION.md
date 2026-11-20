# S06 · маршрут для coding-агента

Не заменяй существующую реализацию. Сначала прочитай изменения G5 **в локальном рабочем дереве**, особенно Vue/DOM-слой onboarding, обработку modal lifecycle и CSS. G5 принят и влит в master через PR #1; перед G6 работай с актуальным деревом, сохраняя все уточнения G5.

## Стартовое исследование

- Проверь `git status`, ветку и факт принятия G5; не выполнять reset/checkout из-за расходящихся документов.
- Изучи текущие `src/App.vue`, стили и компоненты G5, существующие хелперы для демо и сценария. Найди действующие DOM-якоря `.crane-panel`, `.viewport`, `.camera-panel` либо их реальные аналоги.
- Сверь `src/simulation/{Simulator,CraneMotion,DemoSequence,CargoController}.ts`, `config/controls.json`, `evidence/G3/README.md` и `config/g6-route.json`.
- Зарегистрируй новые MD блоки через `node tools/apply-g6.mjs`, проверь `git diff`, устранить старую терминологию о G4 как «конец всего проекта» без стирания истории.

## Рекомендуемые минимальные границы

- `src/App.vue` или composable: интеграция UI-модов и событий G5.
- `src/components/ModeSelection.vue` (возможно): выбор двух режимов с чекбоксом.
- `src/components/GuidedSteps.vue` (возможно): визуальная карточка под правыми рычагами.
- `src/state/guidedRoute.ts` (возможно): типизированные шаги, условия и актуальные инварианты. Данные из `config/g6-route.json` — опорный путь; истина успешности — симуляция.
- `src/simulation/Simulator.ts`: при необходимости expose read-only snapshot `{ actual, target, cargoState, cargoHint, ropeMaximum, ... }`, сигнал об изменении; `resetScenario` для безопасного сброса без демо. Не создавать второй render loop и не управлять `CraneMotion` напрямую из Vue.
- `src/simulation/DemoSequence.ts`: сохранить имеющийся автомат. Не копировать логику автоанимации в step guide и не заставлять Guide подставлять управляющие значения.
- Существующие status/hints перенести физически в `.crane-panel` под регуляторами; не создавать две конкурирующие копии статуса. Исключить overflow и подсказку вне зоны видимости.
- Toolbar в `.viewport`: `Стоп` только при активном demo; круговая стрелка `Сброс сценария`; `Выбрать режим`. Все actions с заголовком и aria-label, правильные disabled/loading состояния.

## Последовательность реализации

1. Встраивание G6 после закрытия G5: гарантировать ровно один overlay в момент времени и правильное восстановление фокуса.
2. Mode select, guided checkbox и переходы к demo/manual, без разрушения текущего состояния Vue/Three.
3. Перестановка status и действий; scene toolbar и отдельный resetScenario; сохранить кнопки нижней камеры.
4. Snapshot фактической симуляции + route-validator без мутаций модели. Реализовать один шаг, затем цикл 10 шагов. Согласовать пороги со `config/controls.json` и предикатами груза.
5. Обработка отката текущего шага, отмена накопленных несостоятельных успехов, верная блокировка «Далее», безопасный выход из guide.
6. Unit + E2E + screenshots; regression G1–G5; обновить `.agent/TASKS.md`, `.agent/STATE.md`, решения/технические отклонения. Попросить пользовательскую приёмку G6.

## Не допускать

- «Сделано», когда только target выставлен, а физическая поза ещё движется.
- Успеха доставки по `gripperOpen=80` без `cargoState=PLACED`.
- Гайда, который сам двигает кран или переключает шаг без кнопки `Далее`.
- Зацикленных reset при закрытии/повторе G5.
- Прежних кнопок demo/stop справа и дубля подсказки слева.
- Потери G4 поведения `stopDemo` / dynamic rope maximum / camera reset.
- Обновления содержимого документов G1–G5 путём копирования старых версий из пакетного архива.

## Контроль качества / доказательства

- `npm run check` и `npm run test:e2e` по фактическим командам локального проекта.
- Unit: pure step validator, target vs actual, границы допуска, cargo/hint, revert, Next gating, transient motion, устойчивость прогресса при изменении последующего целевого значения.
- E2E: first launch G5 skip -> mode select, tutorial finish -> mode select, повторное обучение из help, mode demo, Stop и resume manual, guided complete/revert, free mode no cards, reset scenario vs camera, responsive.
- Скриншоты: `evidence/G6/mode-1672x941.png`, `guided-active-1672x941.png`, `guided-complete-1672x941.png`, `demo-1672x941.png`, `manual-free-1280x720.png`, плюс narrow screenshot 390 px. Только реальные скриншоты работающего приложения.
- Перейти в `AWAITING_APPROVAL`, не принимать G6 за владельца и не начинать G7.
