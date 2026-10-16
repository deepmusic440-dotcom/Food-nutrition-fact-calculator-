# NutriLog

A food nutrition facts calculator and daily intake tracker. It runs entirely in the browser: no server, no account, no build step.

## Features

- **Today**: a calorie budget (goal − food + exercise = remaining), rings for protein, carbs and fat, and nutrient targets marked Met, Low, Near limit or Over. Log foods to breakfast, lunch, dinner and snacks, tap an entry to change the amount, or copy a meal from yesterday. Log exercise (calories estimated from MET values and your weight), water in fluid ounces (tap glasses, quick-add buttons or any amount), and a daily weigh-in. A streak badge counts consecutive days logged.
- **Calculator**: build a recipe or meal from ingredients, set the number of servings, and get an FDA-style Nutrition Facts label per serving with % Daily Values. Save the recipe as one of your foods, or log a serving straight to today.
- **My foods**: add foods from a package label (values per serving), and edit or delete them. Look up the full label for any food in the database.
- **History**: calories per day for the last 7, 14 or 30 days against your goal, weight with a smoothed trend line, averages and a per-day table.
- **Goals**: set daily targets, or estimate them from age, sex, height, weight and activity (Mifflin-St Jeor).
- **Food search**: about 120 common foods built in (values per 100 g, approximated from USDA FoodData Central), searchable by name and category. Amounts can be entered in servings, grams or ounces. Packaged foods can be searched online through [Open Food Facts](https://world.openfoodfacts.org/).
- **Log from photo** (hosted on claude.ai only): take or choose a photo of a meal and Claude estimates each item's portion and nutrients. Untick or resize items before adding them.
- **Backup**: export all data as JSON and restore it on another device.

On first open, the app loads a sample day so you can see how it works. Remove those entries, or use **Goals → Erase all data**, to start fresh.

## Run it

Open `index.html` in a browser. To serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

To host it, enable GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder).

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styles, light and dark themes |
| `foods.js` | Built-in food database |
| `app.js` | App logic: logging, calculator, label, history, goals, storage |

Opened as plain files, data is saved in the browser's `localStorage`, so it stays on that device and browser. When hosted as a claude.ai artifact, data is saved in the artifact's database instead (one document per day under `days/`, settings in `config/main`), so it syncs across your devices and entries Claude adds from chat show up live.

## Notes

Nutrient values are estimates. The calorie and macro targets from the Goals estimator are general guidance, not medical advice.
