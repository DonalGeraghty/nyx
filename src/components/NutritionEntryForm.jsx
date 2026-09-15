import { useState } from 'react'

const EMPTY_ITEM = { food: '', portion: '', calories: '', protein_g: '' }

function localDatetimeValue(value) {
  const date = value ? new Date(value) : new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function NutritionEntryForm({ entry, busy, onCancel, onSave }) {
  const [eatenAt, setEatenAt] = useState(localDatetimeValue(entry?.datetime))
  const [items, setItems] = useState(
    entry?.items?.length
      ? entry.items.map((item) => ({ ...item }))
      : [{ ...EMPTY_ITEM }]
  )

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  const removeItem = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      items: items.map((item) => ({
        food: item.food.trim(),
        portion: item.portion.trim(),
        calories: Number(item.calories),
        protein_g: Number(item.protein_g),
      })),
      eatenAt: new Date(eatenAt).toISOString(),
      sourceMessage: entry?.sourceMessage || null,
    })
  }

  return (
    <section className="entry-editor" aria-labelledby="entry-editor-title">
      <div className="entry-editor-heading">
        <div>
          <h2 id="entry-editor-title">{entry ? 'Edit nutrition entry' : 'Add nutrition entry'}</h2>
          <p>Totals are calculated from the food items below.</p>
        </div>
        <button type="button" className="entry-editor-cancel" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="entry-editor-datetime">
          Date and time
          <input
            type="datetime-local"
            value={eatenAt}
            onChange={(event) => setEatenAt(event.target.value)}
            required
            disabled={busy}
          />
        </label>

        <div className="entry-editor-items">
          {items.map((item, index) => (
            <fieldset key={index} className="entry-editor-item">
              <legend>Food {index + 1}</legend>
              <label>
                Food
                <input
                  type="text"
                  value={item.food}
                  onChange={(event) => updateItem(index, 'food', event.target.value)}
                  maxLength="200"
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Portion
                <input
                  type="text"
                  value={item.portion}
                  onChange={(event) => updateItem(index, 'portion', event.target.value)}
                  placeholder="1 serving"
                  maxLength="200"
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Calories
                <input
                  type="number"
                  value={item.calories}
                  onChange={(event) => updateItem(index, 'calories', event.target.value)}
                  min="0"
                  max="20000"
                  step="1"
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Protein (g)
                <input
                  type="number"
                  value={item.protein_g}
                  onChange={(event) => updateItem(index, 'protein_g', event.target.value)}
                  min="0"
                  max="2000"
                  step="0.1"
                  required
                  disabled={busy}
                />
              </label>
              {items.length > 1 && (
                <button type="button" className="entry-item-remove" onClick={() => removeItem(index)} disabled={busy}>
                  Remove food
                </button>
              )}
            </fieldset>
          ))}
        </div>

        <div className="entry-editor-actions">
          <button
            type="button"
            className="entry-add-food"
            onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
            disabled={busy || items.length >= 30}
          >
            Add another food
          </button>
          <button type="submit" className="entry-save" disabled={busy}>
            {busy ? 'Saving…' : entry ? 'Save changes' : 'Add row'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default NutritionEntryForm
