import { useState, useMemo } from 'react';
import { TagsInput, Loader } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  startAt,
  endAt,
} from 'firebase/firestore';
import { db } from '../config/firebase';

type TagDoc = {
  id: string;      // normalized id (e.g., lowercase)
  name: string;    // display name, original casing
  count: number;   // number of stories
};

export type TagPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;             // optional cap
  minCharsToSearch?: number;    // default 1
  suggestionLimit?: number;     // default 10
  disabled?: boolean;
};

function normalizeId(s: string) {
  return s.trim().toLowerCase();
}

export function TagPicker({
  value,
  onChange,
  placeholder = 'Add tags…',
  maxTags,
  minCharsToSearch = 1,
  suggestionLimit = 10,
  disabled,
}: TagPickerProps) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 200);

  // Query Firestore only when the user typed enough characters
  const enabled = debounced.trim().length >= minCharsToSearch;

  const { data, isFetching } = useQuery<TagDoc[]>({
    queryKey: ['tags-suggest', debounced],
    enabled,
    staleTime: 60_000, // 1 min
    cacheTime: 5 * 60_000,
    queryFn: async () => {
      const s = debounced.trim().toLowerCase();
      if (!s) return [];
      // Prefix query on name_lc via orderBy + startAt/endAt
      // You’ll want each tag doc to include name_lc; if you don’t have it yet,
      // either add it or rely on doc ID being normalized and store display name in `name`.
      const tagsCol = collection(db, 'tags');

      // If your tag IDs are already lowercased and match the searchable field,
      // you can orderBy('name') if 'name' is lowercase-only.
      // Best: keep a 'name_lc' field; here we assume IDs are normalized, so we use 'name' as display only.
      // To keep it fully generic, we try ordering by 'name' (string) and filtering via prefix bounds:
      const qy = query(
        tagsCol,
        orderBy('name'),
        startAt(s),
        endAt(s + '\uf8ff'),
        fbLimit(suggestionLimit)
      );

      const snap = await getDocs(qy);
      const list: TagDoc[] = snap.docs.map((d) => {
        const doc = d.data() as any;
        return {
          id: d.id, // assume your Cloud Functions store tags with normalized IDs
          name: doc.name ?? d.id,
          count: typeof doc.count === 'number' ? doc.count : 0,
        };
      });
      // Sort alphabetically by display name
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });

  const suggestions = useMemo(
    () => (data ?? []).map((t) => ({ value: t.name, label: `${t.name} (${t.count})` })),
    [data]
  );

  const handleCreate = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return null;

    // Enforce maxTags locally (optional)
    if (typeof maxTags === 'number' && value.length >= maxTags) return null;

    // If a suggestion matches case-insensitively, use its canonical casing
    const match = data?.find((t) => normalizeId(t.name) === normalizeId(trimmed));
    const newVal = match ? match.name : trimmed;

    const deduped = dedupeCaseInsensitive([...value, newVal]);
    onChange(deduped);
    return newVal; // Mantine needs the created item returned
  };

  const handleChange = (next: string[]) => {
    // Enforce max tags if provided
    const capped =
      typeof maxTags === 'number' ? next.slice(0, maxTags) : next;

    onChange(dedupeCaseInsensitive(capped));
  };

  return (
    <TagsInput
      value={value}
      onChange={handleChange}
      searchable
      creatable
      getCreateLabel={(q) => `Create "${q}"`}
      onCreate={handleCreate}
      data={suggestions}
      placeholder={placeholder}
      searchValue={search}
      onSearchChange={setSearch}
      rightSection={isFetching ? <Loader size="xs" /> : null}
      disabled={disabled}
      // Small UX niceties
      clearable
      nothingFound={enabled ? 'No matching tags' : 'Type to search tags'}
      maxDropdownHeight={240}
    />
  );
}

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normalizeId(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}
