// src/components/TagPicker.tsx
import { useMemo, useState } from 'react';
import { TagsInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  endAt,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  startAt,
} from 'firebase/firestore';
import { db } from '../config/firebase';

type TagDoc = {
  id: string;    // doc id
  name: string;  // lowercase display name (with spaces)
  count: number; // number of stories using the tag
};

export type TagPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;             // optional cap on number of tags
  minCharsToSearch?: number;    // default 3 (no query until 3+ typed)
  suggestionLimit?: number;     // default 10
  minTagLength?: number;        // default 3 (reject new tags shorter than this)
  disabled?: boolean;
};

/** Lowercase + trim; collapse multiple spaces to one */
function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // <- remove trailing " (123)"
    .replace(/\s+/g, ' ');         // collapse spaces
}

/** Remove all chars except a-z, 0-9, space, hyphen; collapse spaces; trim */
function cleanAllowedChars(s: string) {
  return s.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
}

/** Case-insensitive dedupe that preserves first occurrence */
function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normalize(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function TagPicker({
  value,
  onChange,
  placeholder = 'Separate tags with commas',
  maxTags,
  minCharsToSearch = 3,
  suggestionLimit = 10,
  minTagLength = 3,
  disabled,
}: TagPickerProps) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 200);

  const normalizedSearch = normalize(debounced);
  const enabled = normalizedSearch.length >= minCharsToSearch;

  const { data } = useQuery<TagDoc[]>({
    queryKey: ['tags-suggest', normalizedSearch, suggestionLimit],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const s = normalizedSearch;
      if (!s) return [];

      // /tags docs: { name: <lowercase>, count: number }
      const tagsCol = collection(db, 'tags');
      const qy = fsQuery(
        tagsCol,
        orderBy('name'),
        startAt(s),
        endAt(s + '\uf8ff'),
        fbLimit(suggestionLimit)
      );

      const snap = await getDocs(qy);
      const list: TagDoc[] = snap.docs.map((d) => {
        const doc = d.data() as any;
        const name = typeof doc.name === 'string' ? doc.name : d.id;
        return {
          id: d.id,
          name: normalize(name),
          count: typeof doc.count === 'number' ? doc.count : 0,
        };
      });

      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });

  // TagsInput `data` can be strings or { value, label }
  const suggestions = useMemo(
    () => (data ?? []).map((t) => ({ value: t.name, label: `${t.name} (${t.count})` })),
    [data]
  );

  // Normalize, enforce min length, dedupe, cap
  const sanitize = (arr: string[]) => {
    const lowered = arr.map((t) => cleanAllowedChars(normalize(t)));
    const minFiltered = lowered.filter((t) => t.length >= minTagLength);
    const deduped = dedupeCaseInsensitive(minFiltered);
    return typeof maxTags === 'number' ? deduped.slice(0, maxTags) : deduped;
  };

  const handleChange = (next: string[]) => {
    onChange(sanitize(next));
  };

  return (
    <TagsInput
      data={suggestions}
      value={sanitize(value)}
      onChange={handleChange}
      placeholder={placeholder}
      searchValue={search}
      onSearchChange={setSearch}
      maxDropdownHeight={240}
      disabled={disabled}
      clearable
      // If you want comma to confirm a tag, uncomment:
      // splitChars={[',']}
    />
  );
}
