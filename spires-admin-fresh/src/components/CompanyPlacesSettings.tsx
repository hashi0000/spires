import React, { useEffect, useState } from 'react';
import {
  CompanyPlace,
  companyPlaceSuggestionLabel,
  loadCompanyPlaces,
  saveCompanyPlace,
  seedCompanyPlacesIfEmpty,
  SEEDED_OXFORD_PLACES,
} from '../utils/companyPlaces';

function emptyPlace(): CompanyPlace {
  return {
    id: '',
    label: '',
    address: '',
    postcode: '',
    aliases: [],
    meetingInstructions: '',
    latitude: null,
    longitude: null,
  };
}

function slugId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `place-${Date.now()}`;
}

const CompanyPlacesSettings: React.FC = () => {
  const [places, setPlaces] = useState<CompanyPlace[]>([]);
  const [editing, setEditing] = useState<CompanyPlace | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await loadCompanyPlaces();
      setPlaces(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load company places.');
      setPlaces(SEEDED_OXFORD_PLACES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const startEdit = (place: CompanyPlace) => {
    setEditing({ ...place });
    setAliasesText((place.aliases || []).join(', '));
    setMessage('');
  };

  const startNew = () => {
    setEditing(emptyPlace());
    setAliasesText('');
    setMessage('');
  };

  const onSeed = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const added = await seedCompanyPlacesIfEmpty();
      await refresh();
      setMessage(added > 0 ? `Seeded ${added} Oxford places.` : 'Company places already exist. Nothing was added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not seed company places.');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) {
      window.alert('Enter a place name.');
      return;
    }
    const id = editing.id.trim() || slugId(label);
    const place: CompanyPlace = {
      ...editing,
      id,
      label,
      address: editing.address.trim() || label,
      postcode: editing.postcode.trim(),
      aliases: aliasesText
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      meetingInstructions: String(editing.meetingInstructions || '').trim(),
      latitude: editing.latitude == null || Number.isNaN(Number(editing.latitude)) ? null : Number(editing.latitude),
      longitude: editing.longitude == null || Number.isNaN(Number(editing.longitude)) ? null : Number(editing.longitude),
    };
    setBusy(true);
    setError('');
    try {
      await saveCompanyPlace(place);
      setEditing(null);
      setMessage(`Saved ${companyPlaceSuggestionLabel(place)}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save place.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="places-board">
      <div className="places-board__header">
        <div>
          <h2>Company places</h2>
          <p>Shared pickup labels, aliases and meeting instructions for booking forms and driver cards.</p>
        </div>
        <div className="places-board__actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void onSeed()}>
            Seed Oxford places if empty
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
            Add place
          </button>
        </div>
      </div>

      {message ? <p className="places-status" role="status">{message}</p> : null}
      {error ? <p className="places-status is-error" role="alert">{error}</p> : null}

      {editing ? (
        <div className="places-editor">
          <h3>{editing.id ? 'Edit place' : 'New place'}</h3>
          <div className="places-editor__grid">
            <label>
              Name
              <input
                type="text"
                className="form-input"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </label>
            <label>
              Postcode
              <input
                type="text"
                className="form-input"
                value={editing.postcode}
                onChange={(e) => setEditing({ ...editing, postcode: e.target.value })}
              />
            </label>
            <label className="is-wide">
              Address
              <input
                type="text"
                className="form-input"
                value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </label>
            <label className="is-wide">
              Aliases, comma separated
              <input
                type="text"
                className="form-input"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="Randolph, The Randolph"
              />
            </label>
            <label className="is-wide">
              Meeting instructions
              <textarea
                className="form-input"
                rows={2}
                value={editing.meetingInstructions || ''}
                onChange={(e) => setEditing({ ...editing, meetingInstructions: e.target.value })}
              />
            </label>
          </div>
          <div className="places-editor__actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSave()}>
              Save place
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="places-list">
        {loading ? (
          <p className="places-list__empty">Loading places…</p>
        ) : places.length === 0 ? (
          <p className="places-list__empty">No company places yet. Seed Oxford places or add one.</p>
        ) : (
          <ul className="places-rows">
            {places.map((place) => (
              <li key={place.id} className="places-row">
                <div className="places-row__main">
                  <p className="places-row__title">{companyPlaceSuggestionLabel(place)}</p>
                  <p className="places-row__line">{place.address || '—'}</p>
                  {place.meetingInstructions ? (
                    <p className="places-row__meta">{place.meetingInstructions}</p>
                  ) : null}
                  {place.aliases.length > 0 ? (
                    <p className="places-row__meta">Aliases: {place.aliases.join(', ')}</p>
                  ) : null}
                </div>
                <div className="places-row__action">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(place)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CompanyPlacesSettings;
