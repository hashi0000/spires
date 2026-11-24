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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company places</h2>
          <p className="text-sm text-gray-600 mt-1">
            Shared pickup labels, aliases and meeting instructions for booking forms and driver cards.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" className="btn" disabled={busy} onClick={() => void onSeed()}>
            Seed Oxford places if empty
          </button>
          <button type="button" className="btn-primary" onClick={startNew}>
            Add place
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-gray-700" role="status">{message}</p> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}

      {editing ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">{editing.id ? 'Edit place' : 'New place'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-gray-700">
              Name
              <input
                type="text"
                className="form-input mt-1 w-full"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </label>
            <label className="text-sm text-gray-700">
              Postcode
              <input
                type="text"
                className="form-input mt-1 w-full"
                value={editing.postcode}
                onChange={(e) => setEditing({ ...editing, postcode: e.target.value })}
              />
            </label>
            <label className="text-sm text-gray-700 md:col-span-2">
              Address
              <input
                type="text"
                className="form-input mt-1 w-full"
                value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </label>
            <label className="text-sm text-gray-700 md:col-span-2">
              Aliases (comma separated)
              <input
                type="text"
                className="form-input mt-1 w-full"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="Randolph, The Randolph"
              />
            </label>
            <label className="text-sm text-gray-700 md:col-span-2">
              Meeting instructions
              <textarea
                className="form-input mt-1 w-full"
                rows={2}
                value={editing.meetingInstructions || ''}
                onChange={(e) => setEditing({ ...editing, meetingInstructions: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void onSave()}>
              Save place
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-600 px-4 py-6">Loading places…</p>
        ) : places.length === 0 ? (
          <p className="text-sm text-gray-600 px-4 py-6">No company places yet. Seed Oxford places or add one.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {places.map((place) => (
              <li key={place.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{companyPlaceSuggestionLabel(place)}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{place.address || '—'}</p>
                  {place.meetingInstructions ? (
                    <p className="text-xs text-gray-500 mt-0.5">{place.meetingInstructions}</p>
                  ) : null}
                  {place.aliases.length > 0 ? (
                    <p className="text-xs text-gray-400 mt-0.5">Aliases: {place.aliases.join(', ')}</p>
                  ) : null}
                </div>
                <button type="button" className="text-sm text-indigo-700" onClick={() => startEdit(place)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CompanyPlacesSettings;
