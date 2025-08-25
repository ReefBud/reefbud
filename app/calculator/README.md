# Calculator Tab (Rebuilt)

This replaces the previous ChatGPT chat UI with a deterministic dosing calculator based on provided potencies.
- No OpenAI calls are made from this page.
- Optionally, click "Use preferred product potencies" to pull per-ml-per-litre values from `preferred_products → products`.
- If you input per-ml-per-litre potencies, we multiply by your tank size. If you input per-ml-for-tank, we use that directly.
- The formula used for each parameter:
  `required = current_dose + (target - current) / increase_per_ml_for_tank`.

Ensure environment variables for Supabase are configured in `.env.local` to use the autofill button.